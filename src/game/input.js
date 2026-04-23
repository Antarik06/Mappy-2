import { dijkstra } from './pathfinding';
import { createSwarm } from './swarm';
import { pushEvent } from './worldEvents';

// ============================================================
// COORDINATE HELPERS
// ============================================================
export function toWorld(canvas, gs, x, y) {
    const W = canvas.width, H = canvas.height;
    const offsetX = (W - 900) / 2, offsetY = (H - 700) / 2;
    return {
        x: (x - offsetX - gs.panX) / gs.zoom,
        y: (y - offsetY - gs.panY) / gs.zoom,
    };
}

export function getClosestNode(gs, wx, wy, maxD = 35) {
    let best = null, bestD = maxD;
    gs.nodes.forEach(n => {
        const d = Math.hypot(n.cx - wx, n.cy - wy);
        if (d < bestD) { bestD = d; best = n; }
    });
    return best;
}

export function getEdgeAt(gs, wx, wy) {
    for (const e of gs.edges) {
        const n1 = gs.nodes.find(n => n.id === e.n1);
        const n2 = gs.nodes.find(n => n.id === e.n2);
        if (!n1 || !n2) continue;
        const l2 = Math.hypot(n2.cx - n1.cx, n2.cy - n1.cy) ** 2;
        if (l2 === 0) continue;
        let t = ((wx - n1.cx) * (n2.cx - n1.cx) + (wy - n1.cy) * (n2.cy - n1.cy)) / l2;
        t = Math.max(0, Math.min(1, t));
        const px = n1.cx + t * (n2.cx - n1.cx), py = n1.cy + t * (n2.cy - n1.cy);
        if (Math.hypot(wx - px, wy - py) < 12) return e;
    }
    return null;
}

// ============================================================
// INPUT HANDLERS (operate on game state directly)
// ============================================================
export function processPointerDown(gs, canvas, pos) {
    gs.pointerDown = true;
    gs.pointerDownPos = pos;
    gs.lastPointerPos = pos;
    gs.isPanning = false;
    gs.isDragging = false;
    gs.potentialDragId = null;

    const w = toWorld(canvas, gs, pos.x, pos.y);

    if (gs.mode === "route-select") return;

    const node = getClosestNode(gs, w.x, w.y);
    if (node && node.owner === "player") {
        gs.potentialDragId = node.id;
    } else {
        gs.isPanning = true;
    }
}

export function processPointerMove(gs, canvas, pos) {
    const w = toWorld(canvas, gs, pos.x, pos.y);

    if (gs.mode === "route-select") {
        let bestDist = Infinity, bestIdx = 0;
        gs.attackRoutes.forEach((route, idx) => {
            for (let i = 0; i < route.path.length - 1; i++) {
                const n1 = gs.nodes.find(n => n.id === route.path[i]);
                const n2 = gs.nodes.find(n => n.id === route.path[i + 1]);
                if (!n1 || !n2) continue;
                const l2 = Math.hypot(n2.cx - n1.cx, n2.cy - n1.cy) ** 2;
                if (l2 === 0) continue;
                let t = ((w.x - n1.cx) * (n2.cx - n1.cx) + (w.y - n1.cy) * (n2.cy - n1.cy)) / l2;
                t = Math.max(0, Math.min(1, t));
                const d = Math.hypot(w.x - (n1.cx + t * (n2.cx - n1.cx)), w.y - (n1.cy + t * (n2.cy - n1.cy)));
                if (d < bestDist) { bestDist = d; bestIdx = idx; }
            }
        });
        if (bestDist < 40) gs.hoveredRouteIdx = bestIdx;
        gs.lastPointerPos = pos;
        return;
    }

    if (gs.isPanning && gs.pointerDown) {
        gs.panX += pos.x - gs.lastPointerPos.x;
        gs.panY += pos.y - gs.lastPointerPos.y;
    }

    if (gs.pointerDown && gs.potentialDragId && !gs.isDragging) {
        const dx = pos.x - gs.pointerDownPos.x, dy = pos.y - gs.pointerDownPos.y;
        if (Math.hypot(dx, dy) > 8) {
            gs.isDragging = true;
            gs.selectedNodeId = gs.potentialDragId;
            gs.selectedEnemyId = null;
        }
    }

    if (gs.isDragging) {
        gs.dragPos = w;
        const tNode = getClosestNode(gs, w.x, w.y, 60);
        if (tNode && tNode.id !== gs.selectedNodeId) {
            const src = gs.nodes.find(n => n.id === gs.selectedNodeId);
            if (src) {
                const result = dijkstra(gs.nodes, gs.edges, src.id, tNode.id);
                if (result) { gs.dragTargetId = tNode.id; gs.currentDragPath = result.path; }
                else { gs.dragTargetId = null; gs.currentDragPath = null; }
            }
        } else { gs.dragTargetId = null; gs.currentDragPath = null; }
    }

    gs.lastPointerPos = pos;
}

export function processPointerUp(gs, canvas, pos, ctrlKey = false) {
    const w = toWorld(canvas, gs, pos.x, pos.y);

    if (gs.mode === "route-select") {
        if (gs.hoveredRouteIdx >= 0 && gs.selectedNodeId && gs.selectedEnemyId) {
            const route = gs.attackRoutes[gs.hoveredRouteIdx];
            if (route) {
                const src = gs.nodes.find(n => n.id === gs.selectedNodeId);
                const amt = Math.floor(src.troops * 0.5);
                if (amt >= 1) {
                    gs.swarms.push(createSwarm(src, gs.selectedEnemyId, "player", route.path, amt, gs.nodes));
                    src.troops -= amt;
                }
            }
        }
        gs.mode = "normal";
        gs.selectedNodeId = null;
        gs.selectedEnemyId = null;
        gs.attackRoutes = [];
        gs.pointerDown = false;
        gs.isDragging = false;
        gs.potentialDragId = null;
        gs.isPanning = false;
        return;
    }

    if (gs.isPanning) {
        gs.isPanning = false;
        gs.pointerDown = false;
        if (gs.pointerDownPos) {
            const dx = pos.x - gs.pointerDownPos.x, dy = pos.y - gs.pointerDownPos.y;
            if (Math.hypot(dx, dy) > 8) return; // Only abort click if they actually dragged the map
        }
    }

    if (gs.isDragging) {
        if (gs.selectedNodeId && gs.dragTargetId && gs.currentDragPath) {
            const src = gs.nodes.find(n => n.id === gs.selectedNodeId);
            const amt = Math.floor(src.troops * 0.5);
            if (amt >= 1) {
                gs.swarms.push(createSwarm(src, gs.dragTargetId, "player", gs.currentDragPath, amt, gs.nodes));
                src.troops -= amt;
            }
        }
        gs.isDragging = false;
        gs.selectedNodeId = null;
        gs.dragTargetId = null;
        gs.currentDragPath = null;
        gs.dragPos = null;
        gs.pointerDown = false;
        gs.potentialDragId = null;
        return;
    }

    // Click
    const node = getClosestNode(gs, w.x, w.y);
    if (node) {
        if (node.owner === "player") {
            gs.selectedNodeId = node.id;
            gs.selectedEnemyId = null;
        } else if (gs.selectedNodeId) {
            gs.selectedEnemyId = node.id;
        } else {
            gs.selectedNodeId = null;
            gs.selectedEnemyId = null;
        }
    } else {
        // Ambush?
        const edge = getEdgeAt(gs, w.x, w.y);
        if (edge && ctrlKey) {
            const n1 = gs.nodes.find(n => n.id === edge.n1);
            const n2 = gs.nodes.find(n => n.id === edge.n2);
            
            if (n1.owner !== "player" && n2.owner !== "player") {
                pushEvent(gs, "⚠️ INVALID TARGET", "You must own a connected base!");
            } else {
                const activeAmbushes = gs.edges.filter(e => e.ambushBy === "player").length;
                if (activeAmbushes < 3) {
                    if (!edge.ambushBy) {
                        edge.ambushBy = "player";
                        pushEvent(gs, "💣 AMBUSH PLACED", "Trap set on road! (Max 3)");
                    }
                } else {
                    pushEvent(gs, "⚠️ LIMIT REACHED", "Max 3 active ambushes allowed!");
                }
            }
        } else if (!edge) {
            gs.selectedNodeId = null;
            gs.selectedEnemyId = null;
        }
    }
    gs.pointerDown = false;
    gs.isDragging = false;
    gs.potentialDragId = null;
}

export function processWheel(gs, canvas, deltaY, clientX, clientY) {
    const zf = deltaY > 0 ? 0.9 : 1.1;
    const nz = Math.max(1, Math.min(3, gs.zoom * zf));
    const offsetX = (canvas.width - 900) / 2, offsetY = (canvas.height - 700) / 2;
    const rx = clientX - offsetX, ry = clientY - offsetY;
    gs.panX = rx - (rx - gs.panX) * (nz / gs.zoom);
    gs.panY = ry - (ry - gs.panY) * (nz / gs.zoom);
    gs.zoom = nz;
}
