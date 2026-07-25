// ============================================================
// Voronoi diagram by half-plane clipping.
//
// For ~40 sites this is O(n^2) and runs in well under a millisecond, so
// there is no reason to pull in a dependency. Each cell starts as the map
// rectangle and is clipped by the perpendicular bisector against every
// other site; what survives is that site's cell.
// ============================================================

import { dist2, polygonCentroid } from "./geometry";

/** Sutherland–Hodgman clip of `poly` by the half-plane closer to `site` than `other`. */
function clipByBisector(poly, site, other) {
    const dx = other.x - site.x;
    const dy = other.y - site.y;
    const mx = (site.x + other.x) / 2;
    const my = (site.y + other.y) / 2;
    // Signed distance: negative means "on the site's side", i.e. keep.
    const side = (p) => (p.x - mx) * dx + (p.y - my) * dy;

    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const sa = side(a);
        const sb = side(b);
        if (sa <= 0) out.push(a);
        if ((sa <= 0 && sb > 0) || (sa > 0 && sb <= 0)) {
            const t = sa / (sa - sb);
            out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
    }
    return out;
}

/** Compute one cell polygon for `sites[index]`, clipped to `bounds` rect. */
function computeCell(sites, index, bounds) {
    let poly = [
        { x: bounds.x0, y: bounds.y0 },
        { x: bounds.x1, y: bounds.y0 },
        { x: bounds.x1, y: bounds.y1 },
        { x: bounds.x0, y: bounds.y1 },
    ];
    const site = sites[index];
    for (let j = 0; j < sites.length && poly.length; j++) {
        if (j === index) continue;
        poly = clipByBisector(poly, site, sites[j]);
    }
    return poly;
}

/** All cells for a set of sites. */
export function computeCells(sites, bounds) {
    return sites.map((_, i) => computeCell(sites, i, bounds));
}

/**
 * Lloyd relaxation: repeatedly move each site to its cell's centroid.
 * A few passes turn a clumpy random scatter into evenly-sized territories,
 * which is what makes the map read as hand-drawn rather than noisy.
 */
export function relax(sites, bounds, iterations = 3) {
    let pts = sites.map((p) => ({ ...p }));
    for (let iter = 0; iter < iterations; iter++) {
        const cells = computeCells(pts, bounds);
        pts = pts.map((p, i) => {
            const cell = cells[i];
            if (cell.length < 3) return p;
            const c = polygonCentroid(cell);
            return { x: c.x, y: c.y };
        });
    }
    return pts;
}

/**
 * Neighbour pairs, derived from the finished cells.
 *
 * A polygon edge sits on the bisector between exactly two sites, so the two
 * sites nearest to an edge's midpoint are the pair that shares it. Comparing
 * those two squared distances is both cheap and robust against the tiny
 * floating-point drift the clipping introduces.
 *
 * Returns [{ a, b, length }] with a < b, where a/b are site indices.
 */
export function computeAdjacency(sites, cells, minSharedLength = 6) {
    const found = new Map();

    cells.forEach((cell, i) => {
        if (cell.length < 3) return;
        for (let e = 0; e < cell.length; e++) {
            const p = cell[e];
            const q = cell[(e + 1) % cell.length];
            const edgeLength = Math.hypot(q.x - p.x, q.y - p.y);
            if (edgeLength < minSharedLength) continue;

            const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
            // Nearest site should be i itself; find the runner-up.
            let bestJ = -1;
            let bestD = Infinity;
            for (let j = 0; j < sites.length; j++) {
                if (j === i) continue;
                const d = dist2(mid, sites[j]);
                if (d < bestD) { bestD = d; bestJ = j; }
            }
            if (bestJ < 0) continue;

            const own = dist2(mid, sites[i]);
            // Equidistant (within tolerance) means this edge really is shared.
            if (Math.abs(Math.sqrt(bestD) - Math.sqrt(own)) > 1.5) continue;

            const key = i < bestJ ? `${i}-${bestJ}` : `${bestJ}-${i}`;
            const prev = found.get(key);
            // Keep the segment itself — the renderer draws front lines and
            // impassable ridges directly along the shared border.
            if (prev) {
                if (edgeLength > prev.length) {
                    prev.length = edgeLength;
                    prev.segment = [{ ...p }, { ...q }];
                }
            } else {
                found.set(key, {
                    a: Math.min(i, bestJ),
                    b: Math.max(i, bestJ),
                    length: edgeLength,
                    segment: [{ ...p }, { ...q }],
                });
            }
        }
    });

    return [...found.values()];
}

/**
 * Thin out the road network.
 *
 * Raw Voronoi adjacency averages ~5 neighbours per cell, which makes every
 * territory reachable from everywhere and leaves the map with no defensible
 * structure. Dropping the flimsiest connections — the ones where two cells
 * barely graze each other — creates real fronts and real chokepoints, while
 * long shared borders always keep their road so the map stays legible.
 *
 * Never disconnects the graph and never strands a territory below `minDegree`.
 */
export function pruneAdjacency(links, siteCount, { targetDegree = 3.8, minDegree = 2, keepPercentile = 0.5 } = {}) {
    const degree = new Array(siteCount).fill(0);
    links.forEach((l) => { degree[l.a]++; degree[l.b]++; });

    const sorted = [...links].sort((x, y) => x.length - y.length);
    // Only the shortest borders are ever candidates for removal.
    const cutoff = sorted[Math.floor(sorted.length * keepPercentile)]?.length ?? 0;

    const alive = new Set(links);
    const adjacencyOf = () => {
        const adj = Array.from({ length: siteCount }, () => []);
        alive.forEach((l) => { adj[l.a].push(l.b); adj[l.b].push(l.a); });
        return adj;
    };

    const stillConnected = (adj, from, to, banned) => {
        const seen = new Set([from]);
        const queue = [from];
        while (queue.length) {
            const cur = queue.shift();
            if (cur === to) return true;
            for (const nb of adj[cur]) {
                if (cur === banned.a && nb === banned.b) continue;
                if (cur === banned.b && nb === banned.a) continue;
                if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
            }
        }
        return false;
    };

    for (const link of sorted) {
        const avg = (2 * alive.size) / siteCount;
        if (avg <= targetDegree) break;
        if (link.length > cutoff) break;
        if (degree[link.a] <= minDegree + 1 || degree[link.b] <= minDegree + 1) continue;
        if (!stillConnected(adjacencyOf(), link.a, link.b, link)) continue;

        alive.delete(link);
        degree[link.a]--;
        degree[link.b]--;
    }

    return links.filter((l) => alive.has(l));
}

/**
 * Poisson-ish sampling: dart throwing with a minimum spacing, then top up
 * with whatever fits if we run out of tries. Relaxation cleans up the rest.
 */
export function scatterSites(rng, count, bounds, minSpacing, accept = () => true) {
    const pts = [];
    const maxTries = count * 220;
    let tries = 0;
    let spacing = minSpacing;

    while (pts.length < count && tries < maxTries) {
        tries++;
        // Loosen the constraint if we start struggling, so we always hit `count`.
        if (tries % (count * 30) === 0) spacing *= 0.88;

        const p = {
            x: rng.range(bounds.x0, bounds.x1),
            y: rng.range(bounds.y0, bounds.y1),
        };
        if (!accept(p)) continue;
        const minSq = spacing * spacing;
        if (pts.some((q) => dist2(p, q) < minSq)) continue;
        pts.push(p);
    }
    return pts;
}
