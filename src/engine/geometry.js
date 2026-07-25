// ============================================================
// Small 2D geometry helpers. Points are plain {x, y}.
// ============================================================

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpPoint = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v) => clamp(v, 0, 1);
/** Smooth 0..1 ramp, used all over the renderer for easing. */
export const smoothstep = (t) => { const x = clamp01(t); return x * x * (3 - 2 * x); };

export function polygonCentroid(poly) {
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const cross = a.x * b.y - b.x * a.y;
        area += cross;
        cx += (a.x + b.x) * cross;
        cy += (a.y + b.y) * cross;
    }
    area *= 0.5;
    if (Math.abs(area) < 1e-9) {
        // Degenerate polygon — fall back to the average of its vertices.
        const avg = poly.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
        return { x: avg.x / poly.length, y: avg.y / poly.length };
    }
    return { x: cx / (6 * area), y: cy / (6 * area) };
}

export function polygonArea(poly) {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) * 0.5;
}

export function pointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if ((a.y > p.y) !== (b.y > p.y) &&
            p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Shrink a polygon toward its centroid. Cheap stand-in for a real inset —
 * good enough for the border gutter between territories.
 */
export function insetPolygon(poly, amount) {
    const c = polygonCentroid(poly);
    return poly.map((p) => {
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const len = Math.hypot(dx, dy) || 1;
        const t = Math.max(0, (len - amount) / len);
        return { x: c.x + dx * t, y: c.y + dy * t };
    });
}

/** Distance from point p to segment ab, plus the closest point on it. */
export function closestPointOnSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) return { point: { ...a }, t: 0, distance: dist(p, a) };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = clamp01(t);
    const point = { x: a.x + dx * t, y: a.y + dy * t };
    return { point, t, distance: dist(p, point) };
}

/**
 * Trace a closed path that curves through `pts`, using each point as a
 * quadratic control and the edge midpoints as anchors. Used for coastlines
 * and territory outlines so nothing reads as a hard polygon.
 */
export function traceSmoothClosedPath(ctx, pts) {
    if (pts.length < 3) return;
    const n = pts.length;
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    let anchor = mid(pts[n - 1], pts[0]);
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    for (let i = 0; i < n; i++) {
        const cur = pts[i];
        anchor = mid(cur, pts[(i + 1) % n]);
        ctx.quadraticCurveTo(cur.x, cur.y, anchor.x, anchor.y);
    }
    ctx.closePath();
}
