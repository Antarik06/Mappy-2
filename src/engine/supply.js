// ============================================================
// Supply.
//
// This is the strategic heart of the game. A territory is supplied only if
// a chain of friendly territories links it back to its faction capital.
// Cut the chain and everything behind it stops growing and starts bleeding —
// so encircling a salient beats grinding through it head-on.
// ============================================================

/** Recompute `supplied` for every territory. Cheap enough to run every tick. */
export function recomputeSupply(state) {
    const { territories } = state;
    territories.forEach((t) => { t.supplied = false; });

    for (const factionId of state.factionIds) {
        const capital = territories.find((t) => t.isCapital && t.owner === factionId);
        if (!capital) continue;

        capital.supplied = true;
        const queue = [capital.index];
        while (queue.length) {
            const cur = territories[queue.shift()];
            for (const nb of cur.neighbors) {
                const next = territories[nb];
                if (next.owner === factionId && !next.supplied) {
                    next.supplied = true;
                    queue.push(nb);
                }
            }
        }
    }

    // Neutral ground is never "cut off" — it just sits there.
    territories.forEach((t) => { if (t.owner === "neutral") t.supplied = true; });
}

/**
 * If a faction loses its capital, the largest garrison it still holds takes
 * over as the new seat. Losing the capital is a real blow (everything is
 * briefly unsupplied) without being an instant loss.
 */
export function relocateCapitals(state) {
    for (const factionId of state.factionIds) {
        const owned = state.territories.filter((t) => t.owner === factionId);
        if (!owned.length) continue;
        if (owned.some((t) => t.isCapital)) continue;

        const seat = owned.reduce((best, t) => (t.troops > best.troops ? t : best), owned[0]);
        seat.isCapital = true;
        seat.fort = Math.max(seat.fort, 1);
        state.pendingCapitalMoves.push({ factionId, territory: seat });
    }
}

/**
 * How many enemy territories would be cut off from their capital if `index`
 * changed hands. Drives both the AI's target scoring and the player's
 * "SEVERS N" attack readout.
 */
export function severedIfCaptured(state, index) {
    const { territories } = state;
    const target = territories[index];
    if (!target || target.owner === "neutral") return 0;

    const factionId = target.owner;
    const capital = territories.find((t) => t.isCapital && t.owner === factionId);
    if (!capital || capital.index === index) {
        // Taking the capital itself severs everything not adjacent to a new seat.
        return territories.filter((t) => t.owner === factionId && t.index !== index).length;
    }

    const reachable = new Set([capital.index]);
    const queue = [capital.index];
    while (queue.length) {
        const cur = territories[queue.shift()];
        for (const nb of cur.neighbors) {
            if (nb === index) continue;              // pretend it is already lost
            const next = territories[nb];
            if (next.owner === factionId && !reachable.has(nb)) {
                reachable.add(nb);
                queue.push(nb);
            }
        }
    }

    // `reachable` counts the capital, so it is already the "still supplied" set.
    const stillOwned = territories.filter((t) => t.owner === factionId && t.index !== index).length;
    return Math.max(0, stillOwned - reachable.size);
}
