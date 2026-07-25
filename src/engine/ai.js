// ============================================================
// AI commanders.
//
// Each rival runs the same three-step doctrine every tick:
//   1. Plug holes    — reinforce anything about to fall.
//   2. Spend command — forts on the front, barracks in the rear.
//   3. Pick a fight  — score every reachable target, take the best one.
//
// Personality and difficulty scale the weights, not the logic, so a Warlord
// plays the same game as a Recruit, just sharper.
// ============================================================

import { COMMAND } from "./config";
import { terrainOf } from "./terrain";
import { predictBattle, defenseMultiplier } from "./combat";
import { severedIfCaptured } from "./supply";
import { arrivingTroops, dispatch, findMarchRoute, routeDuration, threatTo, incomingSupport } from "./armies";
import { capacityOf, sendableTroops } from "./state";
import { clamp } from "./geometry";

const RESERVE = 6;

function frontierTargets(state, factionId) {
    const seen = new Set();
    const out = [];
    for (const t of state.territories) {
        if (t.owner !== factionId) continue;
        for (const nb of t.neighbors) {
            if (seen.has(nb)) continue;
            const target = state.territories[nb];
            if (target.owner === factionId) continue;
            seen.add(nb);
            out.push(target);
        }
    }
    return out;
}

/** Is this territory next to someone who isn't us? */
function isBorder(state, territory) {
    return territory.neighbors.some((nb) => state.territories[nb].owner !== territory.owner);
}

// ---- Step 1: defence -----------------------------------------------------

function reinforceThreatened(state, faction) {
    const owned = state.territories.filter((t) => t.owner === faction.id);
    let acted = false;

    for (const t of owned) {
        const incoming = threatTo(state, t.index, faction.id);
        if (incoming <= 0) continue;

        const held = t.troops * defenseMultiplier(t) + incomingSupport(state, t.index, faction.id);
        if (held > incoming * 1.12) continue;   // already safe enough

        // A capital worth saving justifies emptying a quiet neighbour.
        const urgency = t.isCapital ? 1.6 : 1;
        const needed = (incoming * urgency - held) / defenseMultiplier(t);

        const donors = owned
            .filter((d) => d.index !== t.index && d.troops > RESERVE + 4)
            .filter((d) => threatTo(state, d.index, faction.id) < d.troops * 0.6)
            .sort((a, b) => b.troops - a.troops);

        for (const donor of donors) {
            if (!findMarchRoute(state, donor.index, t.index, faction.id)) continue;
            const fraction = clamp(needed / Math.max(1, donor.troops), 0.25, 0.75);
            if (dispatch(state, donor.index, t.index, faction.id, fraction)) {
                acted = true;
                break;
            }
        }
        if (acted) break;   // one rescue per tick keeps rivals from teleporting armies
    }
    return acted;
}

// ---- Step 2: economy -----------------------------------------------------

function spendCommand(state, faction, skill) {
    const owned = state.territories.filter((t) => t.owner === faction.id);
    if (!owned.length) return;

    // Hold back a reserve at higher skill so rallies are available in a crisis.
    const reserve = 20 * skill;
    let budget = faction.command - reserve;
    if (budget < COMMAND.costs.watchtower) return;

    const border = owned.filter((t) => isBorder(state, t));
    const rear = owned.filter((t) => !isBorder(state, t));

    // Fortify the most contested border ground.
    const fortTarget = border
        .filter((t) => t.fort < COMMAND.maxFortLevel && t.supplied)
        .sort((a, b) => (b.isCapital ? 1 : 0) - (a.isCapital ? 1 : 0) || b.chokeScore - a.chokeScore)[0];
    if (fortTarget && budget >= COMMAND.costs.fortify) {
        fortTarget.fort++;
        faction.command -= COMMAND.costs.fortify;
        budget -= COMMAND.costs.fortify;
    }

    // Barracks where they compound: safe, high-growth ground.
    const barracksTarget = (rear.length ? rear : owned)
        .filter((t) => !t.barracks && t.supplied)
        .sort((a, b) => terrainOf(b.terrain).regen - terrainOf(a.terrain).regen)[0];
    if (barracksTarget && budget >= COMMAND.costs.barracks) {
        barracksTarget.barracks = true;
        faction.command -= COMMAND.costs.barracks;
    }
}

// ---- Step 3: offence -----------------------------------------------------

function scoreTarget(state, faction, source, target, troops, personality, skill, context) {
    // Plan against the number that will actually arrive, not the number sent.
    const route = findMarchRoute(state, source.index, target.index, faction.id);
    if (!route) return null;
    const arriving = arrivingTroops(troops, routeDuration(state, route));

    const outcome = predictBattle(arriving, target);
    // Skilled commanders demand a bigger cushion before committing.
    const buffer = 1 + 0.05 + skill * 0.22;
    if (outcome.attack < outcome.defense * buffer) return null;

    const terrain = terrainOf(target.terrain);
    let score = 0;

    // Who are we hitting?
    if (target.owner === "neutral") {
        score += 1.0 * personality.greed;
    } else {
        score += 1.15 * personality.aggression;
        // Gang up on whoever is running away with the map. This is the main
        // brake on a runaway leader — including the player.
        const lead = context.share[target.owner] - context.averageShare;
        if (lead > 0) score += Math.min(1.8, lead * 5.5);
        if (target.owner === context.leader && context.leaderMargin > 0.08) score += 0.7;
    }

    // What is the ground worth?
    score += terrain.command * 6;
    score += (terrain.capacity / 60) * 0.35;
    score += terrain.defense * 0.3;                 // good ground to hold afterwards
    if (target.isChokepoint) score += 0.55;

    // Strategic payoff: cutting an enemy off is worth more than the tile itself.
    if (target.owner !== "neutral") {
        const severed = severedIfCaptured(state, target.index);
        score += severed * 0.85;
        if (target.isCapital) score += 1.8 * personality.aggression;
        if (!target.supplied) score += 0.5;          // already starving, easy meat
    }

    // Cheap wins score higher than pyrrhic ones.
    const overkill = outcome.attack / Math.max(1, outcome.defense);
    score += clamp(overkill - 1, 0, 1.5) * 0.5;

    // Don't strip a territory that is itself under threat.
    const sourceThreat = threatTo(state, source.index, faction.id);
    if (sourceThreat > 0) score -= (sourceThreat / Math.max(1, source.troops)) * 1.4 * personality.caution;
    if (source.isCapital) score -= 0.6 * personality.caution;

    // Distance costs tempo.
    score -= (route.length - 2) * 0.45;

    return { score, route, outcome };
}

function launchAttack(state, faction, personality, skill, aggressionScale, context) {
    const owned = state.territories.filter((t) => t.owner === faction.id);
    const sources = owned
        .filter((t) => t.troops > RESERVE + 6)
        .filter((t) => !state.armies.some((a) => a.owner === faction.id && a.origin === t.index))
        .sort((a, b) => b.troops - a.troops)
        .slice(0, 6);
    if (!sources.length) return false;

    const targets = frontierTargets(state, faction.id)
        // Don't pile onto something already being taken.
        .filter((t) => !state.armies.some((a) => a.owner === faction.id && a.destination === t.index));
    if (!targets.length) return false;

    let best = null;
    for (const source of sources) {
        // Commit hard enough to win, but never empty the tile.
        for (const fraction of [0.5, 0.7, 0.85]) {
            const troops = sendableTroops(source, fraction);
            if (troops < 6) continue;
            if (source.troops - troops < RESERVE * 0.6) continue;

            for (const target of targets) {
                const scored = scoreTarget(state, faction, source, target, troops, personality, skill, context);
                if (!scored) continue;
                if (!best || scored.score > best.score) {
                    best = { ...scored, source, target, fraction };
                }
            }
        }
    }

    const threshold = 1.15 - aggressionScale * 0.5;
    if (!best || best.score < threshold) return false;

    return !!dispatch(state, best.source.index, best.target.index, faction.id, best.fraction);
}

// ---- Entry point ---------------------------------------------------------

/** Shared read of the political situation, computed once per tick. */
function readBoard(state) {
    const playable = state.territories.filter((t) => !t.orphan);
    const total = Math.max(1, playable.length);
    const share = {};
    for (const id of state.factionIds) {
        share[id] = playable.filter((t) => t.owner === id).length / total;
    }
    const living = state.factionIds.filter((id) => state.factions[id].alive);
    const averageShare = living.reduce((s, id) => s + share[id], 0) / Math.max(1, living.length);
    const leader = living.reduce((best, id) => (share[id] > (share[best] ?? 0) ? id : best), living[0]);
    const runnerUp = living.filter((id) => id !== leader).reduce((best, id) => (share[id] > (share[best] ?? -1) ? id : best), null);
    return {
        share,
        averageShare,
        leader,
        leaderMargin: leader && runnerUp ? share[leader] - share[runnerUp] : 0,
    };
}

export function updateAI(state, dt) {
    const { aiTick, aiAggression, aiSkill } = state.difficulty;
    const context = readBoard(state);

    for (const factionId of state.factionIds) {
        const faction = state.factions[factionId];
        if (!faction.alive) continue;
        // In demo mode nobody is at the wheel, so the player's faction is run
        // by the same doctrine as everyone else — that is what makes the
        // menu backdrop a real four-way war rather than a walkover.
        if (faction.isPlayer && !state.demoMode) continue;

        faction.aiCooldown -= dt;
        if (faction.aiCooldown > 0) continue;
        faction.aiCooldown = aiTick * state.rng.range(0.85, 1.2);

        const personality = faction.personality || { aggression: 1, greed: 1, caution: 1 };
        // Falling behind makes a commander bolder; being ahead makes them careful.
        const desperation = clamp(context.averageShare - context.share[factionId], -0.3, 0.4);
        const scaled = {
            aggression: personality.aggression * aiAggression * (1 + desperation * 1.2),
            greed: personality.greed,
            caution: personality.caution * (2 - aiAggression),
        };

        if (reinforceThreatened(state, faction)) continue;
        spendCommand(state, faction, aiSkill);
        launchAttack(state, faction, scaled, aiSkill, aiAggression, context);
    }
}

/** Expose the player-facing capacity read so the HUD and AI agree. */
export const territoryCapacity = capacityOf;
