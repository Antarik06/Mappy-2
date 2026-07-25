// ============================================================
// World generation.
//
// A seed produces a full rectangular board: evenly-sized Voronoi territories
// running edge to edge, contiguous terrain bands driven by elevation/moisture
// fields, and the starting powers placed as far apart as the graph allows.
// ============================================================

import { WORLD, AI_FACTIONS, FACTIONS } from "./config";
import { makeRng } from "./rng";
import { computeCells, computeAdjacency, pruneAdjacency, relax, scatterSites } from "./voronoi";
import { polygonCentroid, polygonArea, clamp, dist } from "./geometry";
import { TERRAIN } from "./terrain";
import { makeNamePool, capitalName } from "./names";

// ---- Fields --------------------------------------------------------------

/**
 * Cheap seeded scalar field: a handful of sine waves at different angles.
 * Returns a function (x, y) -> roughly -1..1. Contiguous by construction,
 * which is exactly what we want for terrain bands.
 */
function makeField(rng, scale = 700) {
    const waves = [];
    for (let i = 0; i < 4; i++) {
        const angle = rng.range(0, Math.PI * 2);
        waves.push({
            dx: Math.cos(angle),
            dy: Math.sin(angle),
            freq: (Math.PI * 2) / (scale * rng.range(0.45, 1.6)),
            phase: rng.range(0, Math.PI * 2),
            amp: rng.range(0.5, 1),
        });
    }
    const total = waves.reduce((s, w) => s + w.amp, 0);
    return (x, y) => {
        let v = 0;
        for (const w of waves) {
            v += Math.sin((x * w.dx + y * w.dy) * w.freq + w.phase) * w.amp;
        }
        return v / total;
    };
}

/**
 * How close a point is to the edge of the board, 0 (dead centre) to 1 (on the
 * boundary). The rectangle's edges are the coastline, which is what makes the
 * outermost ring of territories harbours.
 */
function makeEdgeMetric(width, height) {
    return (x, y) => {
        const toEdge = Math.min(x, y, width - x, height - y);
        return clamp(1 - toEdge / WORLD.coastBand, 0, 1);
    };
}

// ---- Terrain -------------------------------------------------------------

// Share of the map each terrain should occupy. Assigning by quantile rather
// than by raw threshold guarantees every seed gets a usable mix — thresholds
// alone produced maps that were 40% harbour.
const TERRAIN_MIX = { coast: 0.16, mountain: 0.12, hills: 0.17, marsh: 0.09, forest: 0.22 };

/**
 * Assign terrain by ranking territories against the fields, so the bands stay
 * contiguous (the fields are smooth) while the mix stays balanced.
 */
function assignTerrain(territories) {
    const total = territories.length;
    const take = (share) => Math.max(1, Math.round(total * share));
    const remaining = new Set(territories.map((t) => t.index));
    const claim = (list, count, terrainId) => {
        let taken = 0;
        for (const t of list) {
            if (taken >= count) break;
            if (!remaining.has(t.index)) continue;
            t.terrain = terrainId;
            remaining.delete(t.index);
            taken++;
        }
    };

    // Harbours: the most exposed coastline, lowest ground first.
    const coastal = territories
        .filter((t) => t.coastness > 0.35)
        .sort((a, b) => b.coastness - a.coastness || a.elevation - b.elevation);
    claim(coastal, take(TERRAIN_MIX.coast), "coast");

    // Highlands follow the elevation field, so mountains form ridges.
    const byElevation = territories.filter((t) => remaining.has(t.index)).sort((a, b) => b.elevation - a.elevation);
    claim(byElevation, take(TERRAIN_MIX.mountain), "mountain");
    claim(byElevation, take(TERRAIN_MIX.hills), "hills");

    // Wetlands sit in the low, wet spots; woodland fills the rest of the damp.
    const byWet = territories
        .filter((t) => remaining.has(t.index))
        .sort((a, b) => (b.moisture - b.elevation * 0.6) - (a.moisture - a.elevation * 0.6));
    claim(byWet, take(TERRAIN_MIX.marsh), "marsh");
    claim(byWet, take(TERRAIN_MIX.forest), "forest");

    // Whatever is left is farmland.
    territories.forEach((t) => { if (remaining.has(t.index)) t.terrain = "plains"; });
}

// ---- Graph helpers -------------------------------------------------------

function hopDistances(territories, fromIndex) {
    const d = new Array(territories.length).fill(Infinity);
    d[fromIndex] = 0;
    const queue = [fromIndex];
    while (queue.length) {
        const cur = queue.shift();
        for (const nb of territories[cur].neighbors) {
            if (d[nb] === Infinity) {
                d[nb] = d[cur] + 1;
                queue.push(nb);
            }
        }
    }
    return d;
}

/** Farthest-point sampling over graph hops — spreads the starts out. */
function pickStarts(territories, count, rng) {
    const candidates = territories
        .map((t, i) => i)
        .filter((i) => territories[i].neighbors.length >= 2);
    if (!candidates.length) return territories.slice(0, count).map((_, i) => i);

    const first = rng.pick(candidates);
    const chosen = [first];

    while (chosen.length < count) {
        const dists = chosen.map((c) => hopDistances(territories, c));
        let best = -1;
        let bestScore = -Infinity;
        for (const i of candidates) {
            if (chosen.includes(i)) continue;
            // Maximise the distance to the nearest existing start.
            const nearest = Math.min(...dists.map((d) => d[i]));
            if (!Number.isFinite(nearest)) continue;
            const score = nearest + rng.range(0, 0.4);
            if (score > bestScore) { bestScore = score; best = i; }
        }
        if (best < 0) break;
        chosen.push(best);
    }
    return chosen;
}

/**
 * Chokepoints, scored by betweenness centrality: how much of the map's
 * shortest-path traffic is forced through each territory.
 *
 * (Articulation points would be stricter but a relaxed Voronoi board almost
 * never has any — betweenness finds the genuine crossroads that do exist.)
 */
function markChokepoints(territories) {
    const n = territories.length;
    const through = new Array(n).fill(0);

    // Brandes' algorithm on an unweighted graph. n is small; this is instant.
    for (let s = 0; s < n; s++) {
        if (!territories[s].neighbors.length) continue;

        const stack = [];
        const predecessors = Array.from({ length: n }, () => []);
        const pathCount = new Array(n).fill(0);
        const distance = new Array(n).fill(-1);
        pathCount[s] = 1;
        distance[s] = 0;

        const queue = [s];
        while (queue.length) {
            const v = queue.shift();
            stack.push(v);
            for (const w of territories[v].neighbors) {
                if (distance[w] < 0) {
                    distance[w] = distance[v] + 1;
                    queue.push(w);
                }
                if (distance[w] === distance[v] + 1) {
                    pathCount[w] += pathCount[v];
                    predecessors[w].push(v);
                }
            }
        }

        const dependency = new Array(n).fill(0);
        while (stack.length) {
            const w = stack.pop();
            for (const v of predecessors[w]) {
                dependency[v] += (pathCount[v] / pathCount[w]) * (1 + dependency[w]);
            }
            if (w !== s) through[w] += dependency[w];
        }
    }

    const peak = Math.max(1, ...through);
    territories.forEach((t, i) => {
        const centrality = through[i] / peak;
        const degree = t.neighbors.length || 1;
        // Carrying a lot of traffic on few roads is what makes a pass matter.
        t.chokeScore = clamp(centrality * 0.75 + Math.max(0, (4 - degree) / 4) * 0.25, 0, 1);
        t.isChokepoint = t.chokeScore > 0.42 && degree <= 4;
    });
}

// ---- Main ----------------------------------------------------------------

export function generateWorld(seedInput, options = {}) {
    const rng = makeRng(seedInput);
    const width = options.width || WORLD.width;
    const height = options.height || WORLD.height;
    const targetCount = options.territories || WORLD.territories;
    const aiCount = clamp(options.aiCount ?? 3, 1, AI_FACTIONS.length);

    const edgeness = makeEdgeMetric(width, height);
    const bounds = { x0: 0, y0: 0, x1: width, y1: height };
    const margin = WORLD.edgeMargin;

    // Sites fill the whole board, held just off the boundary so the outermost
    // cells come out as solid squarish blocks rather than thin slivers.
    const sites = scatterSites(
        rng,
        targetCount,
        { x0: margin, y0: margin, x1: width - margin, y1: height - margin },
        WORLD.minSiteSpacing,
    );

    const relaxed = relax(sites, bounds, WORLD.relaxIterations).map((p) => ({
        x: clamp(p.x, margin, width - margin),
        y: clamp(p.y, margin, height - margin),
    }));

    const cells = computeCells(relaxed, bounds);
    // Every pair of touching cells is a *border*; only some borders carry a
    // *road*. Borders without a road are impassable ridges — the renderer
    // marks them so "why can't I attack there?" is answered by looking.
    const allBorders = computeAdjacency(relaxed, cells);
    const adjacency = pruneAdjacency(allBorders, relaxed.length);
    const roadSet = new Set(adjacency);

    const elevationField = makeField(rng, 780);
    const moistureField = makeField(rng, 620);
    const names = makeNamePool(rng, relaxed.length);

    const territories = relaxed.map((site, i) => {
        const cell = cells[i];
        const centroid = cell.length >= 3 ? polygonCentroid(cell) : site;
        const coastness = edgeness(centroid.x, centroid.y);
        const elevation = elevationField(centroid.x, centroid.y);
        const moisture = moistureField(centroid.x, centroid.y);

        return {
            index: i,
            id: `t${i}`,
            name: names[i],
            site,
            cell,
            centroid,
            area: cell.length >= 3 ? polygonArea(cell) : 0,
            neighbors: [],
            borders: {},          // neighbourIndex -> shared border length
            terrain: "plains",    // replaced by assignTerrain() below
            elevation,
            moisture,
            coastness,
            owner: "neutral",
            troops: 0,
            fort: 0,
            barracks: false,
            watchtower: false,
            isCapital: false,
            supplied: false,
            // Fog: ownership is always visible, garrison strength is not.
            intel: 0,             // last-known troop count for the player
            intelAt: -1,
            lastCombatAt: -1,
            lastCaptureAt: -1,
            disorderUntil: -1,
            chokeScore: 0,
            isChokepoint: false,
        };
    });

    // Wire adjacency both ways, remembering border length for rendering.
    const roads = [];
    adjacency.forEach(({ a, b, length, segment }) => {
        const ta = territories[a];
        const tb = territories[b];
        if (!ta || !tb) return;
        ta.neighbors.push(b);
        tb.neighbors.push(a);
        ta.borders[b] = length;
        tb.borders[a] = length;
        roads.push({
            id: `r${a}-${b}`,
            a,
            b,
            length: dist(ta.centroid, tb.centroid),
            borderLength: length,
            segment,
        });
    });

    const borders = allBorders.map((link) => ({
        a: link.a,
        b: link.b,
        segment: link.segment,
        length: link.length,
        hasRoad: roadSet.has(link),
    }));

    // Drop anything the graph orphaned — an unreachable territory is dead weight.
    const connected = new Set(hopDistances(territories, 0).map((d, i) => (Number.isFinite(d) ? i : -1)).filter((i) => i >= 0));
    if (connected.size < territories.length) {
        territories.forEach((t) => {
            if (!connected.has(t.index)) {
                t.neighbors = [];
                t.orphan = true;
            }
        });
    }

    assignTerrain(territories.filter((t) => !t.orphan));
    markChokepoints(territories);

    // ---- Starting powers -------------------------------------------------
    const playable = territories.filter((t) => !t.orphan);
    const factionIds = ["player", ...AI_FACTIONS.slice(0, aiCount)];
    const startIndices = pickStarts(territories, factionIds.length, rng);

    factionIds.forEach((factionId, n) => {
        const idx = startIndices[n];
        if (idx == null) return;
        const capital = territories[idx];
        capital.owner = factionId;
        capital.isCapital = true;
        capital.troops = 34;
        capital.fort = 1;
        capital.name = capitalName(rng, FACTIONS[factionId].name.split(" ")[0]);

        // Two adjacent holdings so nobody starts in a one-territory corner.
        const seeds = rng.shuffle(capital.neighbors).filter((i) => territories[i].owner === "neutral");
        seeds.slice(0, 2).forEach((i) => {
            territories[i].owner = factionId;
            territories[i].troops = 12;
        });
    });

    // ---- Neutral garrisons ----------------------------------------------
    // Tougher terrain and better-connected ground defends harder, so the map
    // has natural "cheap" and "expensive" directions to expand in.
    playable.forEach((t) => {
        if (t.owner !== "neutral") return;
        const terrain = TERRAIN[t.terrain];
        const richness = terrain.command * 60 + terrain.regen;
        // Rich, defensible and strategically important ground costs more to
        // take, so the map has cheap directions and expensive ones.
        t.troops = Math.round(clamp(
            9 + terrain.defense * 6 + richness * 3 + (t.isChokepoint ? 6 : 0) + rng.range(-2, 5),
            10,
            34,
        ));
    });

    return {
        seed: String(seedInput),
        width,
        height,
        territories,
        roads,
        borders,
        factionIds,
    };
}
