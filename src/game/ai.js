import { dijkstra } from './pathfinding';
import { createSwarm } from './swarm';

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

// ============================================================
// AI LOGIC
// ============================================================
export function processAI(gs) {
    const advantage = computePlayerAdvantage(gs.nodes, gs.swarms, "player");
    // advantage > 0.6 = player winning hard → AI becomes aggressive
    // advantage < 0.4 = player losing → AI eases off
    const aggressiveness = 0.3 + advantage * 0.7; // 0.3..1.0

    const ais = ["ai1", "ai2", "ai3"];
    ais.forEach(ai => {
        const myNodes = gs.nodes.filter(n => n.owner === ai && n.troops > 15);
        if (!myNodes.length) return;

        // Pick best source (most troops)
        myNodes.sort((a, b) => b.troops - a.troops);
        const src = myNodes[0];

        // Find best target: enemy/neutral with fewer troops (weighted by difficulty)
        const candidates = gs.nodes.filter(n => n.owner !== ai && n.id !== src.id);
        if (!candidates.length) return;

        // Compute scores
        let best = null, bestScore = -Infinity;
        candidates.forEach(c => {
            const result = dijkstra(gs.nodes, gs.edges, src.id, c.id);
            if (!result) return;
            const pathCost = result.cost / 200; // normalise
            const troopAdvantage = (src.troops - c.troops) / Math.max(1, src.troops);
            const isPlayer = c.owner === "player" ? aggressiveness : 0.5;
            const score = troopAdvantage * isPlayer - pathCost * 0.5;
            if (score > bestScore) { bestScore = score; best = { node: c, path: result.path }; }
        });

        if (best && bestScore > (advantage > 0.6 ? 0.05 : 0.2)) {
            const sendAmt = Math.floor(src.troops * (0.4 + aggressiveness * 0.3));
            if (sendAmt < 5) return;
            gs.swarms.push(createSwarm(src, best.node.id, ai, best.path, sendAmt, gs.nodes));
            src.troops -= sendAmt;
        }
    });
}
