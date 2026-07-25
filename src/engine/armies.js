// ============================================================
// Marching armies: dispatch, movement, interception, arrival.
// ============================================================

import { COMBAT, MARCH } from "./config";
import { terrainOf } from "./terrain";
import { lerpPoint, dist } from "./geometry";
import { resolveArrival } from "./combat";
import { nextArmyId, pushLog, spawnEffect, sendableTroops } from "./state";

/** Freshly captured ground can't launch its own attack yet. */
export function isInDisorder(state, territory) {
    return (territory.disorderUntil ?? -1) > state.time;
}

export function disorderRemaining(state, territory) {
    return Math.max(0, (territory.disorderUntil ?? -1) - state.time);
}

/** Shortest hop path between two territories, or null. */
export function findPath(state, fromIndex, toIndex) {
    if (fromIndex === toIndex) return null;
    const prev = new Map([[fromIndex, null]]);
    const queue = [fromIndex];
    while (queue.length) {
        const cur = queue.shift();
        if (cur === toIndex) break;
        for (const nb of state.territories[cur].neighbors) {
            if (prev.has(nb)) continue;
            prev.set(nb, cur);
            queue.push(nb);
        }
    }
    if (!prev.has(toIndex)) return null;

    const path = [];
    let cur = toIndex;
    while (cur !== null && cur !== undefined) {
        path.unshift(cur);
        cur = prev.get(cur);
    }
    return path;
}

/**
 * A march route for the player: friendly ground is passed through, the first
 * hostile territory on the way is where the fight happens. Prefers routes
 * that stay on your own ground rather than the raw shortest hop count.
 */
export function findMarchRoute(state, fromIndex, toIndex, owner) {
    if (fromIndex === toIndex) return null;
    const { territories } = state;

    // Dijkstra with a small penalty for stepping onto ground you don't hold,
    // so armies prefer to travel behind their own lines.
    const cost = new Map([[fromIndex, 0]]);
    const prev = new Map([[fromIndex, null]]);
    const open = [{ index: fromIndex, cost: 0 }];

    while (open.length) {
        open.sort((a, b) => a.cost - b.cost);
        const { index: cur, cost: curCost } = open.shift();
        if (curCost > (cost.get(cur) ?? Infinity)) continue;
        if (cur === toIndex) break;
        // An army stops at the first hostile territory, so hostile ground is
        // never a through-route — only ever a destination.
        if (cur !== fromIndex && territories[cur].owner !== owner) continue;

        for (const nb of territories[cur].neighbors) {
            const t = territories[nb];
            const step = dist(territories[cur].centroid, t.centroid) / terrainOf(t.terrain).speed;
            const next = curCost + step;
            if (next < (cost.get(nb) ?? Infinity)) {
                cost.set(nb, next);
                prev.set(nb, cur);
                open.push({ index: nb, cost: next });
            }
        }
    }

    if (!prev.has(toIndex)) return null;
    const path = [];
    let cur = toIndex;
    while (cur !== null && cur !== undefined) {
        path.unshift(cur);
        cur = prev.get(cur);
    }
    return path.length >= 2 ? path : null;
}

export function legSpeed(state, fromT, toT) {
    const terrainSpeed = (terrainOf(fromT.terrain).speed + terrainOf(toT.terrain).speed) / 2;
    const eventSpeed = state.activeEvent?.speedScale ?? 1;
    return MARCH.baseSpeed * terrainSpeed * eventSpeed;
}

/** Seconds for an army to walk the whole route — used by the attack preview. */
export function routeDuration(state, path) {
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const a = state.territories[path[i]];
        const b = state.territories[path[i + 1]];
        total += dist(a.centroid, b.centroid) / legSpeed(state, a, b);
    }
    return total;
}

/**
 * How many of `troops` actually reach the far end after `duration` seconds
 * on the road. Used by the odds preview and the AI so both plan against the
 * same numbers the simulation will produce.
 */
export function arrivingTroops(troops, duration) {
    return Math.max(MARCH.minArrivals, Math.round(troops - MARCH.attritionPerSecond * duration));
}

export function armyPosition(state, army) {
    const a = state.territories[army.path[army.leg]];
    const b = state.territories[army.path[army.leg + 1]];
    if (!a || !b) return a?.centroid ?? { x: 0, y: 0 };
    return lerpPoint(a.centroid, b.centroid, army.progress);
}

/** Dispatch troops. Returns the army, or null if the order was illegal. */
export function dispatch(state, sourceIndex, targetIndex, owner, fraction) {
    const source = state.territories[sourceIndex];
    const target = state.territories[targetIndex];
    if (!source || !target || source.owner !== owner || sourceIndex === targetIndex) return null;
    if (isInDisorder(state, source)) return null;

    const troops = sendableTroops(source, fraction);
    if (troops <= 0) return null;

    const path = findMarchRoute(state, sourceIndex, targetIndex, owner);
    if (!path) return null;

    source.troops -= troops;
    const army = {
        id: nextArmyId(),
        owner,
        troops,
        path,
        leg: 0,
        progress: 0,
        origin: sourceIndex,
        destination: targetIndex,
        spawnedAt: state.time,
    };
    state.armies.push(army);
    spawnEffect(state, { kind: "dispatch", at: source.centroid, owner, life: 0.7 });
    state.revision++;
    return army;
}

// ---- Per-tick movement ---------------------------------------------------

function clash(state, a, b) {
    // Head-on meeting in the field. No terrain, no forts — pure weight.
    const survivorsA = a.troops - b.troops;
    const at = armyPosition(state, a);
    spawnEffect(state, { kind: "clash", at, life: 1.0 });

    if (Math.abs(survivorsA) < 0.5) {
        a.dead = true;
        b.dead = true;
    } else if (survivorsA > 0) {
        a.troops = Math.max(1, Math.round(survivorsA));
        b.dead = true;
    } else {
        b.troops = Math.max(1, Math.round(-survivorsA));
        a.dead = true;
    }

    const involvesPlayer = a.owner === "player" || b.owner === "player";
    if (involvesPlayer) {
        pushLog(state, {
            title: "Field battle",
            body: "Two columns met on the road.",
            tone: "combat",
        });
    }
}

/** Armies moving toward each other on the same road fight where they meet. */
function resolveInterceptions(state) {
    const armies = state.armies;
    for (let i = 0; i < armies.length; i++) {
        const a = armies[i];
        if (a.dead) continue;
        const aFrom = a.path[a.leg];
        const aTo = a.path[a.leg + 1];
        for (let j = i + 1; j < armies.length; j++) {
            const b = armies[j];
            if (b.dead || b.owner === a.owner) continue;
            // Same road, opposite directions.
            if (b.path[b.leg] !== aTo || b.path[b.leg + 1] !== aFrom) continue;
            if (a.progress + b.progress < 1) continue;      // haven't met yet

            const pa = armyPosition(state, a);
            const pb = armyPosition(state, b);
            if (dist(pa, pb) > COMBAT.interceptRange) continue;
            clash(state, a, b);
            if (a.dead) break;
        }
    }
}

export function updateArmies(state, dt, onArrival) {
    for (const army of state.armies) {
        if (army.dead) continue;
        const from = state.territories[army.path[army.leg]];
        const to = state.territories[army.path[army.leg + 1]];
        if (!to) { army.dead = true; continue; }

        const legLength = dist(from.centroid, to.centroid) || 1;
        army.progress += (legSpeed(state, from, to) * dt) / legLength;
        // Columns bleed stragglers on the march — distance costs troops.
        army.troops = Math.max(MARCH.minArrivals, army.troops - MARCH.attritionPerSecond * dt);

        while (army.progress >= 1 && !army.dead) {
            army.progress -= 1;
            army.leg++;
            const node = state.territories[army.path[army.leg]];
            const isFinalLeg = army.leg >= army.path.length - 1;

            // Stop and fight at the first ground you don't hold, even if the
            // order pointed further on — the front line moved while you marched.
            if (node.owner !== army.owner || isFinalLeg) {
                const result = resolveArrival(state, army, node);
                army.dead = true;
                onArrival?.(result, army);
                break;
            }
            army.progress = Math.min(army.progress, 0.999);
        }
    }

    resolveInterceptions(state);
    state.armies = state.armies.filter((a) => !a.dead);
}

/** Incoming hostile strength headed at a territory — used by the AI and the HUD. */
export function threatTo(state, index, defenderId) {
    let total = 0;
    for (const army of state.armies) {
        if (army.owner === defenderId) continue;
        if (army.path[army.path.length - 1] !== index) continue;
        total += army.troops;
    }
    return total;
}

export function incomingSupport(state, index, ownerId) {
    let total = 0;
    for (const army of state.armies) {
        if (army.owner !== ownerId) continue;
        if (army.path[army.path.length - 1] !== index) continue;
        total += army.troops;
    }
    return total;
}
