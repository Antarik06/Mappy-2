// ============================================================
// Visual design tokens.
//
// The look: a lit campaign map on a dark war table. Cold ink around the
// edges, warm land in the middle, faction colour washing across territory
// like spilled dye, and heat where two powers touch.
// ============================================================

export const PALETTE = {
    // Table and sea
    void: "#070A0F",
    voidWarm: "#0C1119",
    sea: "#0D1826",
    seaDeep: "#070E18",
    seaFoam: "rgba(126,178,204,0.20)",

    // Land
    shore: "#1A2028",
    landEdge: "#2A3340",
    parchment: "#C9BFA4",

    // Ink and type
    ink: "#F2EEE4",
    inkSoft: "rgba(242,238,228,0.62)",
    inkFaint: "rgba(242,238,228,0.30)",
    inkLine: "rgba(8,11,16,0.55)",

    // Signals
    gold: "#E8B54B",
    goldSoft: "rgba(232,181,75,0.35)",
    hot: "#FF7043",
    danger: "#FF5470",
    good: "#5FD6A4",
    supply: "rgba(232,181,75,0.5)",
    cutoff: "#C2413F",
};

/** Split "#RRGGBB" into channels. */
export function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

export function mixHex(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const m = (x, y) => Math.round(x + (y - x) * t);
    return `rgb(${m(ca.r, cb.r)},${m(ca.g, cb.g)},${m(ca.b, cb.b)})`;
}

/** Lighten/darken by a factor. `amount` > 0 lightens. */
export function shade(hex, amount) {
    const { r, g, b } = hexToRgb(hex);
    const f = (c) => Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export const FONT = {
    display: '"Cinzel", "Iowan Old Style", Georgia, serif',
    ui: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    // Tabular figures matter: troop counts must not jitter as they tick.
    numeric: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
};
