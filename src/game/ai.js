import { dijkstra } from './pathfinding';
import { createSwarm } from './swarm';

const AI_OWNERS = ["ai1", "ai2", "ai3"];
const AI_MIN_RESERVE = 14;
const AI_MAX_SEND_RATIO = 0.58;
const AI_NEUTRAL_BIAS = 1.2;
const AI_PLAYER_BIAS = 1.65;

// ============================================================
// AI DIFFICULTY ADAPTATION
// ============================================================
export function computePlayerAdvantage(nodes, swarms, playerOwner) {
    let playerTroops = 0, playerNodes = 0, enemyTroops = 0, enemyNodes = 0;
    nodes.forEach(n => {
        if (n.owner === playerOwner) { playerTroops += n.troops; playerNodes++; }
        else if (n.owner !== "neutral") { enemyTroops += n.troops; enemyNodes++; }
    });
    swarms.forEach(s => {
        if (s.owner === playerOwner) playerTroops += s.dots.length;
        else if (s.owner !== "neutral") enemyTroops += s.dots.length;
    });
    const nodeAdv = playerNodes / Math.max(1, playerNodes + enemyNodes);
    const troopAdv = playerTroops / Math.max(1, playerTroops + enemyTroops);
    return (nodeAdv + troopAdv) / 2; // 0..1, >0.5 = player winning
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function buildAdjacency(nodes, edges) {
    const adj = {};
    nodes.forEach(n => adj[n.id] = []);
    edges.forEach(e => {
        adj[e.n1]?.push(e.n2);
        adj[e.n2]?.push(e.n1);
    });
    return adj;
}

function pathAttrition(edges, path, owner) {
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const edge = edges.find(e => (
            (e.n1 === path[i] && e.n2 === path[i + 1]) ||
            (e.n2 === path[i] && e.n1 === path[i + 1])
        ));
        if (!edge || edge.ambushBy === owner) continue;
        total += Math.min(15, Math.max(5, Math.round(edge.weight / 20)));
    }
    return total;
}

function hasActiveAttack(gs, owner, sourceId, targetId) {
    return gs.swarms.some(s =>
        s.owner === owner &&
        (s.source === sourceId || s.target === targetId) &&
        s.dots.length > 0
    );
}

function ensureAiState(gs) {
    if (!gs.aiState) gs.aiState = {};
    AI_OWNERS.forEach(owner => {
        if (!gs.aiState[owner]) gs.aiState[owner] = { cooldown: 0 };
    });
}

// ============================================================
// AI LOGIC
// ============================================================
export function processAI(gs) {
    ensureAiState(gs);
    const adjacency = buildAdjacency(gs.nodes, gs.edges);
    const playerNodesCount = gs.nodes.filter(n => n.owner === "player").length;

    // Scale pressure with player progress, but keep a floor so enemies still expand.
    const playerNodeFactor = clamp(playerNodesCount / 9, 0, 1);
    const advantage = computePlayerAdvantage(gs.nodes, gs.swarms, "player");
    const aggression = clamp(0.2 + advantage * 0.45 + playerNodeFactor * 0.35, 0.2, 0.95);
    const maxRouteHops = playerNodeFactor > 0.72 ? 3 : 2;

    AI_OWNERS.forEach(ai => {
        const aiMemory = gs.aiState[ai];
        if (aiMemory.cooldown > 0) {
            aiMemory.cooldown -= 1;
            return;
        }

        const minTroopsToAttack = 22 + (1 - aggression) * 18;
        const myNodes = gs.nodes
            .filter(n => n.owner === ai && n.troops > minTroopsToAttack)
            .sort((a, b) => b.troops - a.troops);
        if (!myNodes.length) return;

        let best = null;
        let bestScore = -Infinity;

        myNodes.forEach(src => {
            if (gs.swarms.some(s => s.owner === ai && s.source === src.id)) return;

            const frontierIds = new Set(adjacency[src.id] || []);
            const candidates = gs.nodes.filter(target => {
                if (target.owner === ai || target.id === src.id) return false;
                if (target.owner === "player" && playerNodesCount <= 1) return false;
                if (hasActiveAttack(gs, ai, src.id, target.id)) return false;
                return frontierIds.has(target.id) || playerNodeFactor > 0.55;
            });

            candidates.forEach(target => {
                const hopRoute = dijkstra(gs.nodes, gs.edges, src.id, target.id, true);
                if (!hopRoute) return;
                const hops = hopRoute.path.length - 1;
                if (hops <= 0 || hops > maxRouteHops) return;

                const distanceRoute = dijkstra(gs.nodes, gs.edges, src.id, target.id);
                if (!distanceRoute) return;

                const attrition = pathAttrition(gs.edges, distanceRoute.path, ai);
                const captureBuffer = target.owner === "player" ? 8 : 3;
                const needed = Math.ceil(target.troops + attrition + captureBuffer);
                const available = Math.floor(src.troops - AI_MIN_RESERVE);
                if (available < needed) return;

                const sendRatio = clamp(0.38 + aggression * 0.18, 0.38, AI_MAX_SEND_RATIO);
                const sendAmt = Math.min(available, Math.max(needed, Math.floor(src.troops * sendRatio)));
                if (sendAmt < 6) return;

                const ownerBias = target.owner === "player"
                    ? AI_PLAYER_BIAS * clamp(advantage + 0.25, 0.5, 1.25)
                    : target.owner === "neutral"
                        ? AI_NEUTRAL_BIAS
                        : 0.85;
                const localBonus = frontierIds.has(target.id) ? 1.15 : 0.75;
                const weakness = (sendAmt - needed) / Math.max(1, needed);
                const distancePenalty = distanceRoute.cost / 380;
                const score = ownerBias * localBonus + weakness - distancePenalty - (hops - 1) * 0.4;

                if (score > bestScore) {
                    bestScore = score;
                    best = { src, target, path: distanceRoute.path, sendAmt };
                }
            });
        });

        if (!best || bestScore < 0.25) return;

        gs.swarms.push(createSwarm(best.src, best.target.id, ai, best.path, best.sendAmt));
        best.src.troops -= best.sendAmt;

        // Longer cooldowns early make the map breathe; shorter cooldowns late keep pressure on.
        aiMemory.cooldown = Math.round(clamp(3 - aggression * 2, 1, 3));
    });
}
