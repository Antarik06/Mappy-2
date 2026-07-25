// ============================================================
// Game state construction and read-only selectors.
// ============================================================

import { COMMAND, DIFFICULTIES, EVENTS, FACTIONS, MARCH } from "./config";
import { generateWorld } from "./worldgen";
import { makeRng } from "./rng";
import { recomputeSupply } from "./supply";
import { terrainOf } from "./terrain";
import { clamp } from "./geometry";

let armyCounter = 0;
export const nextArmyId = () => `a${++armyCounter}`;

export function createGame({ seed, difficulty = "commander", aiCount } = {}) {
    const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.commander;
    const world = generateWorld(seed, { aiCount: aiCount ?? diff.aiCount ?? 2 });
    const rng = makeRng(`${seed}:sim:${diff.id}`);

    const factions = {};
    world.factionIds.forEach((id) => {
        factions[id] = {
            id,
            ...FACTIONS[id],
            command: COMMAND.startingPoints,
            alive: true,
            eliminatedAt: null,
            aiCooldown: rng.range(0, diff.aiTick),
            peakTerritories: 0,
            captures: 0,
            losses: 0,
        };
    });

    const state = {
        seed: world.seed,
        difficulty: diff,
        world,
        factionIds: world.factionIds,
        territories: world.territories,
        roads: world.roads,
        factions,
        rng,

        time: 0,
        paused: false,
        speed: 1,
        outcome: null,          // { result: "victory" | "defeat", reason }

        armies: [],
        effects: [],
        log: [],
        pendingCapitalMoves: [],

        activeEvent: null,
        nextEventAt: EVENTS.firstDelay,

        dominationTimer: 0,
        sendFraction: MARCH.defaultSendFraction,

        // Bumped whenever something happened that the HUD needs to redraw for.
        revision: 0,
    };

    recomputeSupply(state);
    refreshIntel(state);
    return state;
}

// ---- Selectors -----------------------------------------------------------

export const territoriesOf = (state, factionId) =>
    state.territories.filter((t) => t.owner === factionId);

export const playableTerritories = (state) =>
    state.territories.filter((t) => !t.orphan);

export function factionStanding(state, factionId) {
    const owned = territoriesOf(state, factionId);
    const marching = state.armies.filter((a) => a.owner === factionId);
    return {
        id: factionId,
        territories: owned.length,
        troops: Math.round(owned.reduce((s, t) => s + t.troops, 0)),
        marching: Math.round(marching.reduce((s, a) => s + a.troops, 0)),
        supplied: owned.filter((t) => t.supplied).length,
        alive: state.factions[factionId].alive,
        command: Math.floor(state.factions[factionId].command),
    };
}

export function allStandings(state) {
    return state.factionIds
        .map((id) => factionStanding(state, id))
        .sort((a, b) => b.territories - a.territories || b.troops - a.troops);
}

/** Growth per second for a territory, before global event modifiers. */
export function regenRate(state, territory) {
    if (territory.owner === "neutral") return 0;
    if (!territory.supplied) return 0;
    const terrain = terrainOf(territory.terrain);
    const cap = capacityOf(territory);
    if (territory.troops >= cap) return 0;

    let rate = terrain.regen * (territory.barracks ? 1.4 : 1);
    const faction = state.factions[territory.owner];
    if (faction?.isPlayer) rate *= state.difficulty.playerRegenBonus;
    else rate *= state.difficulty.aiRegenBonus;
    if (state.activeEvent?.regenScale) rate *= state.activeEvent.regenScale;

    return rate;
}

export function capacityOf(territory) {
    const terrain = terrainOf(territory.terrain);
    return terrain.capacity + (territory.barracks ? 15 : 0) + territory.fort * 4;
}

/**
 * Command income per second across a faction's supplied holdings.
 *
 * Deliberately sub-linear: a sprawling empire is harder to administer, so
 * each extra territory pays a little less than the last. Without this the
 * first power to pull ahead simply out-produces everyone into a walkover.
 */
export function commandIncome(state, factionId) {
    let raw = 0;
    let count = 0;
    for (const t of state.territories) {
        if (t.owner !== factionId || !t.supplied) continue;
        raw += terrainOf(t.terrain).command * (t.isCapital ? 2 : 1);
        count++;
    }
    const administration = 1 / (1 + 0.03 * Math.max(0, count - 6));
    let income = raw * administration;
    if (state.activeEvent?.commandScale) income *= state.activeEvent.commandScale;
    return income;
}

/** Share of the playable map a faction holds, 0..1. */
export function mapShare(state, factionId) {
    const playable = state.territories.filter((t) => !t.orphan);
    if (!playable.length) return 0;
    return playable.filter((t) => t.owner === factionId).length / playable.length;
}

// ---- Fog of war ----------------------------------------------------------
//
// Ownership is always visible — the map should read at a glance. Garrison
// strength is only known next to your own lines, or further out with a
// watchtower. Everything else shows a stale last-known number.

export function visionRadiusOf(territory) {
    return territory.watchtower ? 2 : 1;
}

export function refreshIntel(state, factionId = "player") {
    const { territories } = state;

    // Multi-source flood carrying the *remaining* vision range, keeping the
    // largest budget at each territory. A plain visited-set would let a
    // radius-1 holding claim a territory first and cut a neighbouring
    // watchtower's second step short — silently wasting what you paid for.
    const budget = new Map();
    const queue = [];
    for (const t of territories) {
        if (t.owner !== factionId) continue;
        const radius = visionRadiusOf(t);
        if ((budget.get(t.index) ?? -1) < radius) {
            budget.set(t.index, radius);
            queue.push(t.index);
        }
    }

    while (queue.length) {
        const index = queue.shift();
        const remaining = budget.get(index) ?? 0;
        if (remaining <= 0) continue;
        for (const nb of territories[index].neighbors) {
            if ((budget.get(nb) ?? -1) < remaining - 1) {
                budget.set(nb, remaining - 1);
                queue.push(nb);
            }
        }
    }

    for (const t of territories) {
        t.visible = budget.has(t.index);
        if (t.visible) {
            t.intel = t.troops;
            t.intelAt = state.time;
        }
    }
    return new Set(budget.keys());
}

/** What the player is allowed to see for a territory. */
export function knownTroops(territory) {
    if (territory.visible) return { value: Math.round(territory.troops), stale: false, known: true };
    if (territory.intelAt >= 0) return { value: Math.round(territory.intel), stale: true, known: true };
    return { value: null, stale: true, known: false };
}

// ---- Logging -------------------------------------------------------------

export function pushLog(state, entry) {
    state.log.unshift({
        id: `l${state.log.length}-${Math.random().toString(36).slice(2, 7)}`,
        at: state.time,
        tone: "neutral",
        ...entry,
    });
    if (state.log.length > 40) state.log.length = 40;
    state.revision++;
}

// ---- Effects (purely visual) --------------------------------------------

export function spawnEffect(state, effect) {
    state.effects.push({
        id: `e${Math.random().toString(36).slice(2, 9)}`,
        born: state.time,
        life: 1.1,
        ...effect,
    });
    if (state.effects.length > 160) state.effects.splice(0, state.effects.length - 160);
}

/** Clamp a send amount to what the source can legally commit. */
export function sendableTroops(source, fraction) {
    const available = Math.max(0, Math.floor(source.troops) - MARCH.garrisonKeep);
    const wanted = Math.floor(source.troops * clamp(fraction, MARCH.minSendFraction, MARCH.maxSendFraction));
    return Math.max(0, Math.min(available, wanted));
}
