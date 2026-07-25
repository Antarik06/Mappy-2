// ============================================================
// Player orders. Every one of these is a pure entry point the UI calls —
// nothing in the render layer is allowed to mutate state directly.
// ============================================================

import { COMMAND } from "./config";
import {
    arrivingTroops,
    disorderRemaining,
    dispatch,
    findMarchRoute,
    isInDisorder,
    routeDuration,
    threatTo,
    incomingSupport,
} from "./armies";
import { predictBattle, defenseMultiplier } from "./combat";
import { severedIfCaptured } from "./supply";
import { capacityOf, pushLog, sendableTroops, spawnEffect } from "./state";

const PLAYER = "player";

function spend(state, cost) {
    const f = state.factions[PLAYER];
    if (f.command < cost) return false;
    f.command -= cost;
    return true;
}

export function canAfford(state, key) {
    return state.factions[PLAYER].command >= COMMAND.costs[key];
}

// ---- Session controls ----------------------------------------------------

export function setPaused(state, paused) {
    state.paused = paused;
    state.revision++;
    return state.paused;
}

export function togglePause(state) {
    return setPaused(state, !state.paused);
}

// ---- Territory upgrades --------------------------------------------------

export function fortify(state, index) {
    const t = state.territories[index];
    if (!t || t.owner !== PLAYER) return { ok: false, reason: "Not yours to build on." };
    if (t.fort >= COMMAND.maxFortLevel) return { ok: false, reason: "Already at maximum fortification." };
    if (!spend(state, COMMAND.costs.fortify)) return { ok: false, reason: "Not enough command." };

    t.fort++;
    spawnEffect(state, { kind: "build", at: t.centroid, owner: PLAYER, life: 0.9 });
    pushLog(state, { title: `${t.name} fortified`, body: `Walls at level ${t.fort}.`, tone: "good", territory: index });
    state.revision++;
    return { ok: true };
}

export function buildBarracks(state, index) {
    const t = state.territories[index];
    if (!t || t.owner !== PLAYER) return { ok: false, reason: "Not yours to build on." };
    if (t.barracks) return { ok: false, reason: "Barracks already standing." };
    if (!spend(state, COMMAND.costs.barracks)) return { ok: false, reason: "Not enough command." };

    t.barracks = true;
    spawnEffect(state, { kind: "build", at: t.centroid, owner: PLAYER, life: 0.9 });
    pushLog(state, { title: `Barracks at ${t.name}`, body: "Recruitment up 40%.", tone: "good", territory: index });
    state.revision++;
    return { ok: true };
}

export function buildWatchtower(state, index) {
    const t = state.territories[index];
    if (!t || t.owner !== PLAYER) return { ok: false, reason: "Not yours to build on." };
    if (t.watchtower) return { ok: false, reason: "Watchtower already standing." };
    if (!spend(state, COMMAND.costs.watchtower)) return { ok: false, reason: "Not enough command." };

    t.watchtower = true;
    spawnEffect(state, { kind: "build", at: t.centroid, owner: PLAYER, life: 0.9 });
    pushLog(state, { title: `Watchtower at ${t.name}`, body: "Scouts see two steps out.", tone: "good", territory: index });
    state.revision++;
    return { ok: true };
}

export function rally(state, index) {
    const t = state.territories[index];
    if (!t || t.owner !== PLAYER) return { ok: false, reason: "Not yours to raise from." };
    if (!t.supplied) return { ok: false, reason: "Cut off — no levies can reach it." };
    if (!spend(state, COMMAND.costs.rally)) return { ok: false, reason: "Not enough command." };

    t.troops += COMMAND.rallyTroops;
    spawnEffect(state, { kind: "rally", at: t.centroid, owner: PLAYER, life: 0.9 });
    state.revision++;
    return { ok: true };
}

// ---- Attacking -----------------------------------------------------------

/**
 * Everything the UI needs to describe an order before it is given.
 * Pure — called every frame while dragging.
 */
export function previewOrder(state, sourceIndex, targetIndex, fraction) {
    const source = state.territories[sourceIndex];
    const target = state.territories[targetIndex];
    if (!source || !target || source.owner !== PLAYER || sourceIndex === targetIndex) return null;

    const route = findMarchRoute(state, sourceIndex, targetIndex, PLAYER);
    if (!route) return null;

    const troops = sendableTroops(source, fraction);
    const friendly = target.owner === PLAYER;
    const duration = routeDuration(state, route);
    const arriving = arrivingTroops(troops, duration);
    const disorder = isInDisorder(state, source);
    const blocked = disorder ? `Regrouping — ${disorderRemaining(state, source).toFixed(1)}s` : null;

    if (friendly) {
        return {
            kind: "reinforce",
            valid: troops > 0 && !disorder,
            blocked,
            troops,
            arriving,
            route,
            duration,
            target,
            source,
            resultText: blocked || `+${arriving} garrison`,
        };
    }

    const outcome = predictBattle(arriving, target);
    // Only promise an outcome for ground we can actually see.
    const known = target.visible;
    const severs = target.owner !== "neutral" ? severedIfCaptured(state, targetIndex) : 0;

    return {
        kind: "attack",
        valid: troops > 0 && !disorder,
        blocked,
        troops,
        arriving,
        route,
        duration,
        target,
        source,
        known,
        outcome,
        severs,
        defenseMultiplier: defenseMultiplier(target),
        resultText: blocked
            ? blocked
            : !known
                ? "Strength unknown"
                : outcome.captures
                    ? `Takes it — ${outcome.survivors} left standing`
                    : `Repelled — ${outcome.survivors} defenders hold`,
    };
}

export function order(state, sourceIndex, targetIndex, fraction) {
    const preview = previewOrder(state, sourceIndex, targetIndex, fraction);
    if (!preview || !preview.valid) return { ok: false, reason: "No route, or nothing to send." };

    const army = dispatch(state, sourceIndex, targetIndex, PLAYER, fraction);
    if (!army) return { ok: false, reason: "No route, or nothing to send." };

    pushLog(state, {
        title: preview.kind === "reinforce"
            ? `${preview.troops} marching to ${preview.target.name}`
            : `${preview.troops} attacking ${preview.target.name}`,
        body: `${Math.ceil(preview.duration)}s on the road.`,
        tone: "neutral",
        territory: targetIndex,
    });
    return { ok: true, army, preview };
}

// ---- Read-outs for the territory panel -----------------------------------

export function territoryReport(state, index) {
    const t = state.territories[index];
    if (!t) return null;
    return {
        territory: t,
        capacity: capacityOf(t),
        defense: defenseMultiplier(t),
        threat: threatTo(state, index, t.owner),
        support: incomingSupport(state, index, t.owner),
        severs: t.owner !== "neutral" ? severedIfCaptured(state, index) : 0,
    };
}
