// ============================================================
// Deterministic random. Same seed => same world, always.
// ============================================================

/** Hash an arbitrary string/number into a 32-bit seed. */
export function hashSeed(input) {
    const str = String(input ?? "");
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

/** mulberry32 — small, fast, good enough distribution for a game. */
export function makeRng(seed) {
    let a = hashSeed(seed);
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    next.range = (min, max) => min + next() * (max - min);
    next.int = (min, max) => Math.floor(next.range(min, max + 1));
    next.pick = (arr) => arr[Math.floor(next() * arr.length) % arr.length];
    next.chance = (p) => next() < p;
    next.shuffle = (arr) => {
        const out = arr.slice();
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(next() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    };
    /** Weighted pick. `weights` parallel to `arr`. */
    next.weighted = (arr, weights) => {
        const total = weights.reduce((s, w) => s + w, 0);
        let roll = next() * total;
        for (let i = 0; i < arr.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return arr[i];
        }
        return arr[arr.length - 1];
    };

    return next;
}

/** Human-friendly seed like "K7RA-92MD". */
export function randomSeedString() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 8; i++) {
        if (i === 4) out += "-";
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
}
