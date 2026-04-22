import { findKPaths } from './pathfinding';
import { createJetStrike } from './swarm';
import { pushEvent } from './worldEvents';

// ============================================================
// PLAYER ACTIONS
// ============================================================
export function startRouteSelect(gs) {
    if (!gs || !gs.selectedNodeId || !gs.selectedEnemyId) return;
    const src = gs.nodes.find(n => n.id === gs.selectedNodeId);
    if (!src) return;
    const routes = findKPaths(gs.nodes, gs.edges, gs.selectedNodeId, gs.selectedEnemyId, 4);
    gs.attackRoutes = routes;
    gs.hoveredRouteIdx = 0;
    gs.mode = "route-select";
}

export function upgradeAirbase(gs) {
    if (!gs || !gs.selectedNodeId) return;
    const n = gs.nodes.find(x => x.id === gs.selectedNodeId);
    if (n && n.owner === "player" && n.troops >= 50 && !n.isAirbase) {
        n.troops -= 50; n.isAirbase = true;
        pushEvent(gs, "✈️ AIRBASE BUILT", `${n.name} is now an airbase!`);
    }
}

export function launchAirstrike(gs) {
    if (!gs || !gs.selectedNodeId || !gs.selectedEnemyId) return;
    const src = gs.nodes.find(n => n.id === gs.selectedNodeId);
    if (src && src.isAirbase && src.owner === "player") {
        gs.jets.push(createJetStrike(src.id, gs.selectedEnemyId, "player"));
        gs.selectedEnemyId = null;
        gs.mode = "normal";
    }
}
