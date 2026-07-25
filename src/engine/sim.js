// ============================================================
// The tick. Everything that advances the world by dt seconds.
// ============================================================

import { COMMAND, GROWTH, VICTORY } from "./config";
import { recomputeSupply, relocateCapitals } from "./supply";
import { updateArmies } from "./armies";
import { updateAI } from "./ai";
import { updateEvents } from "./events";
import {
    capacityOf,
    commandIncome,
    pushLog,
    refreshIntel,
    regenRate,
    spawnEffect,
} from "./state";
import { clamp } from "./geometry";

const MAX_DT = 0.05;    // never simulate more than 50ms in one step

function growGarrisons(state, dt) {
    for (const t of state.territories) {
        if (t.owner === "neutral") continue;

        if (!t.supplied) {
            // Cut off: no growth, and the garrison starts to melt away.
            t.troops = Math.max(GROWTH.unsuppliedFloor, t.troops - GROWTH.unsuppliedAttrition * dt);
            continue;
        }

        const cap = capacityOf(t);
        if (t.troops >= cap) continue;
        // Logistic growth: fast when a holding is empty, tapering at capacity.
        const rate = regenRate(state, t) * GROWTH.k * (1 - t.troops / cap);
        t.troops = Math.min(cap, t.troops + rate * dt);
    }
}

function accrueCommand(state, dt) {
    for (const id of state.factionIds) {
        const f = state.factions[id];
        if (!f.alive) continue;
        f.command = clamp(f.command + commandIncome(state, id) * dt, 0, COMMAND.max);
    }
}

function handleArrival(state, result, army) {
    const isPlayer = army.owner === "player";
    const wasPlayers = result.before?.owner === "player";
    const target = result.target;

    if (result.type === "capture") {
        state.factions[army.owner].captures++;
        if (result.previousOwner !== "neutral") state.factions[result.previousOwner].losses++;
        spawnEffect(state, { kind: "capture", at: target.centroid, owner: army.owner, life: 1.5 });

        if (isPlayer || wasPlayers) {
            pushLog(state, {
                title: isPlayer ? `${target.name} taken` : `${target.name} lost`,
                body: result.wasCapital ? "A capital seat has fallen." : null,
                tone: isPlayer ? "good" : "bad",
                territory: target.index,
            });
        }
        return;
    }

    if (result.type === "repelled") {
        spawnEffect(state, { kind: "repelled", at: target.centroid, owner: army.owner, life: 1.1 });
        if (isPlayer || wasPlayers) {
            pushLog(state, {
                title: isPlayer ? `Assault broken at ${target.name}` : `${target.name} holds`,
                body: `${result.survivors} defenders still standing.`,
                tone: isPlayer ? "bad" : "good",
                territory: target.index,
            });
        }
        return;
    }

    if (result.type === "reinforce" && isPlayer) {
        spawnEffect(state, { kind: "reinforce", at: target.centroid, owner: army.owner, life: 0.8 });
    }
}

function updateEliminations(state) {
    for (const id of state.factionIds) {
        const f = state.factions[id];
        if (!f.alive) continue;
        const owned = state.territories.filter((t) => t.owner === id).length;
        const marching = state.armies.some((a) => a.owner === id);
        f.peakTerritories = Math.max(f.peakTerritories, owned);
        if (owned === 0 && !marching) {
            f.alive = false;
            f.eliminatedAt = state.time;
            pushLog(state, {
                title: `${f.name} is destroyed`,
                tone: f.isPlayer ? "bad" : "good",
            });
        }
    }
}

function checkVictory(state, dt) {
    if (state.outcome) return;

    const player = state.factions.player;
    if (!player.alive) {
        state.outcome = { result: "defeat", reason: "Your banners have fallen from every hold." };
        return;
    }

    const rivals = state.factionIds.filter((id) => id !== "player");
    const aliveRivals = rivals.filter((id) => state.factions[id].alive);
    if (aliveRivals.length === 0) {
        state.outcome = { result: "victory", reason: "Every rival power has been destroyed." };
        return;
    }

    // Domination: hold most of the map for a sustained stretch.
    const playable = state.territories.filter((t) => !t.orphan);
    const mine = playable.filter((t) => t.owner === "player").length;
    const share = mine / Math.max(1, playable.length);
    if (share >= VICTORY.dominationShare) {
        state.dominationTimer += dt;
        if (state.dominationTimer >= VICTORY.holdSeconds) {
            state.outcome = { result: "victory", reason: `You held ${Math.round(share * 100)}% of the map.` };
        }
    } else {
        state.dominationTimer = Math.max(0, state.dominationTimer - dt * 2);
    }
    state.dominationShare = share;
}

let intelClock = 0;

export function tick(state, rawDt) {
    if (!state || state.paused || state.outcome) return;

    const dt = Math.min(rawDt, MAX_DT) * state.speed;
    if (dt <= 0) return;
    state.time += dt;

    growGarrisons(state, dt);
    accrueCommand(state, dt);
    updateArmies(state, dt, (result, army) => handleArrival(state, result, army));

    // Ownership may have changed above — supply and seats must follow.
    recomputeSupply(state);
    state.pendingCapitalMoves.length = 0;
    relocateCapitals(state);
    for (const move of state.pendingCapitalMoves) {
        if (move.factionId === "player") {
            pushLog(state, {
                title: "Seat of command moved",
                body: `${move.territory.name} is now your capital.`,
                tone: "warn",
                territory: move.territory.index,
            });
        }
    }
    if (state.pendingCapitalMoves.length) recomputeSupply(state);

    updateAI(state, dt);
    updateEvents(state, dt);
    updateEliminations(state);

    intelClock += dt;
    if (intelClock >= 0.2) {
        intelClock = 0;
        refreshIntel(state, "player");
        // A fog bank blinds everything beyond your own holdings.
        if (state.activeEvent?.blindsScouts) {
            for (const t of state.territories) {
                if (t.owner !== "player") t.visible = false;
            }
        }
    }

    state.effects = state.effects.filter((e) => state.time - e.born < e.life);
    checkVictory(state, dt);
}
