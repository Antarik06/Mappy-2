// ============================================================
// The static half of the map: terrain fills, hand-drawn-looking terrain
// marks, territory outlines and impassable ridges, edge to edge.
//
// None of this changes during a match, so it is painted once into an
// offscreen canvas and blitted each frame. Ownership, armies and effects
// are drawn live on top.
// ============================================================

import { PALETTE, rgba, shade } from "./palette";
import { terrainOf } from "../engine/terrain";
import { makeRng } from "../engine/rng";


const SUPERSAMPLE = 1.5;   // extra resolution so the map stays crisp zoomed in

function tracePolygon(ctx, poly) {
    if (!poly.length) return;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
}

// ---- Terrain marks -------------------------------------------------------

/**
 * Spread `density` marks per 10,000 world units² across the whole cell, not
 * just around its centre — Voronoi cells vary a lot in size and shape, and
 * marks bunched at the centroid leave the edges looking bald.
 */
function scatterInCell(rng, cell, density) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of cell) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    const area = (maxX - minX) * (maxY - minY);
    const count = Math.round((area / 10000) * density);
    const points = [];
    for (let i = 0; i < count; i++) {
        points.push({ x: rng.range(minX, maxX), y: rng.range(minY, maxY) });
    }
    return points;
}

function drawTrees(ctx, rng, cell, accent) {
    ctx.strokeStyle = rgba(accent, 0.75);
    ctx.fillStyle = rgba(accent, 0.4);
    ctx.lineWidth = 1.8;
    for (const p of scatterInCell(rng, cell, 3.4)) {
        const h = rng.range(13, 21);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + h * 0.5);
        ctx.lineTo(p.x - h * 0.4, p.y + h * 0.5);
        ctx.lineTo(p.x, p.y - h * 0.5);
        ctx.lineTo(p.x + h * 0.4, p.y + h * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

function drawPeaks(ctx, rng, cell, accent) {
    ctx.lineJoin = "round";
    for (const p of scatterInCell(rng, cell, 1.9)) {
        const w = rng.range(26, 44);
        const h = rng.range(18, 30);
        ctx.beginPath();
        ctx.moveTo(p.x - w / 2, p.y + h / 2);
        ctx.lineTo(p.x, p.y - h / 2);
        ctx.lineTo(p.x + w / 2, p.y + h / 2);
        ctx.strokeStyle = rgba(accent, 0.85);
        ctx.lineWidth = 2.4;
        ctx.stroke();
        // Snow line on the taller peaks.
        ctx.beginPath();
        ctx.moveTo(p.x - w * 0.15, p.y - h * 0.14);
        ctx.lineTo(p.x, p.y - h / 2);
        ctx.lineTo(p.x + w * 0.15, p.y - h * 0.14);
        ctx.strokeStyle = rgba("#FFFFFF", 0.5);
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function drawHills(ctx, rng, cell, accent) {
    ctx.strokeStyle = rgba(accent, 0.72);
    ctx.lineWidth = 2.2;
    for (const p of scatterInCell(rng, cell, 2.6)) {
        const w = rng.range(20, 34);
        ctx.beginPath();
        ctx.arc(p.x, p.y, w / 2, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
    }
}

function drawFurrows(ctx, rng, cell, accent) {
    ctx.strokeStyle = rgba(accent, 0.5);
    ctx.lineWidth = 1.8;
    const tilt = rng.range(-0.3, 0.3);
    for (const p of scatterInCell(rng, cell, 4.5)) {
        const len = rng.range(22, 44);
        ctx.beginPath();
        ctx.moveTo(p.x - len / 2, p.y - (len / 2) * tilt);
        ctx.lineTo(p.x + len / 2, p.y + (len / 2) * tilt);
        ctx.stroke();
    }
}

function drawReeds(ctx, rng, cell, accent) {
    ctx.strokeStyle = rgba(accent, 0.7);
    ctx.lineWidth = 2;
    for (const p of scatterInCell(rng, cell, 3.2)) {
        const w = rng.range(24, 40);
        ctx.beginPath();
        ctx.moveTo(p.x - w / 2, p.y);
        ctx.quadraticCurveTo(p.x - w / 4, p.y - 7, p.x, p.y);
        ctx.quadraticCurveTo(p.x + w / 4, p.y + 7, p.x + w / 2, p.y);
        ctx.stroke();
    }
}

function drawStipple(ctx, rng, cell, accent) {
    ctx.fillStyle = rgba(accent, 0.5);
    for (const p of scatterInCell(rng, cell, 11)) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, rng.range(1.1, 2.6), 0, Math.PI * 2);
        ctx.fill();
    }
}

const MARKS = {
    plains: drawFurrows,
    forest: drawTrees,
    hills: drawHills,
    mountain: drawPeaks,
    marsh: drawReeds,
    coast: drawStipple,
};

// ---- Layer build ---------------------------------------------------------

export function buildTerrainLayer(world) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(world.width * SUPERSAMPLE);
    canvas.height = Math.ceil(world.height * SUPERSAMPLE);
    const ctx = canvas.getContext("2d");
    ctx.scale(SUPERSAMPLE, SUPERSAMPLE);

    // The board is a filled rectangle edge to edge — no coastline, no dead
    // space. This base only shows through as hairlines between cells.
    ctx.fillStyle = PALETTE.shore;
    ctx.fillRect(0, 0, world.width, world.height);

    // --- Territory fills --------------------------------------------------
    for (const t of world.territories) {
        if (!t.cell || t.cell.length < 3) continue;
        const terrain = terrainOf(t.terrain);

        // Cover the whole cell, whatever its shape — cells vary widely in size.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of t.cell) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }

        ctx.save();
        tracePolygon(ctx, t.cell);
        ctx.clip();

        const g = ctx.createLinearGradient(minX, minY, maxX, maxY);
        g.addColorStop(0, shade(terrain.fill, 0.12));
        g.addColorStop(1, terrain.fillDeep);
        ctx.fillStyle = g;
        ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

        // Stable per-territory marks: same seed, same map, every reload.
        const rng = makeRng(`${world.seed}:marks:${t.index}`);
        MARKS[terrain.id]?.(ctx, rng, t.cell, terrain.accent);

        // Inner shading so each territory reads as its own piece of ground
        // even when two neighbours share a terrain type.
        ctx.strokeStyle = rgba("#050709", 0.5);
        ctx.lineWidth = 14;
        tracePolygon(ctx, t.cell);
        ctx.stroke();

        ctx.restore();
    }

    // --- Territory outlines ----------------------------------------------
    ctx.lineJoin = "round";
    for (const t of world.territories) {
        if (!t.cell || t.cell.length < 3) continue;
        tracePolygon(ctx, t.cell);
        ctx.strokeStyle = PALETTE.inkLine;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // --- Impassable ridges ------------------------------------------------
    // Borders with no road get hatched, so it is obvious at a glance why an
    // attack can't cross there.
    for (const border of world.borders) {
        if (border.hasRoad || !border.segment) continue;
        const [p, q] = border.segment;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        ctx.strokeStyle = rgba("#0A0D13", 0.7);
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();

        ctx.strokeStyle = rgba("#0A0D13", 0.5);
        ctx.lineWidth = 2;
        const ticks = Math.max(2, Math.floor(len / 13));
        for (let i = 0; i <= ticks; i++) {
            const t = i / ticks;
            const x = p.x + dx * t;
            const y = p.y + dy * t;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + nx * 6, y + ny * 6);
            ctx.stroke();
        }
    }

    // --- Board edge -------------------------------------------------------
    // A dark inner falloff at the boundary so the map reads as a lit table
    // rather than a texture that has simply been cut off.
    const edge = 120;
    const sides = [
        { x: 0, y: 0, w: world.width, h: edge, gx0: 0, gy0: 0, gx1: 0, gy1: edge },
        { x: 0, y: world.height - edge, w: world.width, h: edge, gx0: 0, gy0: world.height, gx1: 0, gy1: world.height - edge },
        { x: 0, y: 0, w: edge, h: world.height, gx0: 0, gy0: 0, gx1: edge, gy1: 0 },
        { x: world.width - edge, y: 0, w: edge, h: world.height, gx0: world.width, gy0: 0, gx1: world.width - edge, gy1: 0 },
    ];
    for (const s of sides) {
        const g = ctx.createLinearGradient(s.gx0, s.gy0, s.gx1, s.gy1);
        g.addColorStop(0, "rgba(4,6,10,0.8)");
        g.addColorStop(1, "rgba(4,6,10,0)");
        ctx.fillStyle = g;
        ctx.fillRect(s.x, s.y, s.w, s.h);
    }

    ctx.strokeStyle = rgba("#050709", 0.9);
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, world.width, world.height);

    return { canvas, scale: SUPERSAMPLE };
}
