// ============================================================
// Combat resolution.
//
// One readable formula, used identically by the player, the AI and the
// odds preview — so what the UI promises is exactly what happens.
// ============================================================

import { COMBAT } from "./config";
import { terrainOf } from "./terrain";

/** Total multiplier applied to a territory's raw garrison when defending. */
export function defenseMultiplier(territory) {
    const terrain = terrainOf(territory.terrain);
    let mult = terrain.defense * (1 + territory.fort * COMBAT.fortDefenseStep);
    // Cut-off garrisons fight worse — no reinforcement, no resupply.
    if (!territory.supplied && territory.owner !== "neutral") {
        mult *= COMBAT.unsuppliedDefensePenalty;
    }
    return mult;
}

/** Effective attacking strength after terrain effects at the destination. */
export function attackStrength(troops, target) {
    const terrain = terrainOf(target.terrain);
    // Woodland defenders get the first bite.
    const ambush = terrain.id === "forest" ? 1 - COMBAT.ambushLoss : 1;
    return troops * ambush;
}

/**
 * Predict the result of throwing `troops` at `target`. Pure — safe to call
 * every frame from the drag preview.
 */
export function predictBattle(troops, target) {
    const mult = defenseMultiplier(target);
    const attack = attackStrength(troops, target);
    const defense = target.troops * mult;
    const captures = attack > defense;

    return {
        captures,
        attack,
        defense,
        multiplier: mult,
        // What is left standing on the winning side, in raw troops.
        survivors: captures
            ? Math.max(COMBAT.minCaptureSurvivors, Math.round(attack - defense))
            : Math.max(1, Math.round((defense - attack) / mult)),
        // 0..1 confidence, for the odds bar. Deliberately not a probability:
        // combat is deterministic, this is a margin readout.
        margin: defense <= 0 ? 1 : Math.max(0, Math.min(1, attack / (defense || 1) / 2)),
    };
}

/**
 * Apply an arriving army to a territory. Mutates `target` and returns a
 * description of what happened for the log/effects layer.
 */
export function resolveArrival(state, army, target) {
    const troops = Math.max(0, Math.round(army.troops));
    if (troops <= 0) return { type: "fizzle", target };

    // Friendly ground: reinforce. Stacking above capacity is allowed —
    // massing an army is a legitimate play, growth just stops up there.
    if (target.owner === army.owner) {
        target.troops += troops;
        return { type: "reinforce", target, troops };
    }

    const before = { owner: target.owner, troops: target.troops };
    const outcome = predictBattle(troops, target);
    target.lastCombatAt = state.time;

    if (outcome.captures) {
        const previousOwner = target.owner;
        const wasCapital = target.isCapital;
        target.owner = army.owner;
        target.troops = outcome.survivors;
        target.lastCaptureAt = state.time;
        // A garrison that just stormed a place can't immediately march on.
        target.disorderUntil = state.time + COMBAT.disorderSeconds;
        // Captured infrastructure is wrecked; the fort survives at reduced strength.
        target.fort = Math.max(0, target.fort - 1);
        target.barracks = false;
        target.watchtower = false;
        // A stormed seat stops being one. The dispossessed faction gets a new
        // capital next tick via relocateCapitals(); the captor keeps its own.
        target.isCapital = false;
        return { type: "capture", target, troops, previousOwner, survivors: outcome.survivors, wasCapital, before };
    }

    target.troops = outcome.survivors;
    return { type: "repelled", target, troops, survivors: outcome.survivors, before };
}
