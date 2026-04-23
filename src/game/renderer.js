import { OWNER_COLORS, OWNER_GLOW } from './constants';

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawHUD(ctx, canvas, gs, ts) {
    const W = canvas.width, H = canvas.height;

    // Draw events (bottom left)
    gs.events.forEach((ev, i) => {
        const alpha = Math.min(1, (ev.expiresAt - Date.now()) / 1000);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(10,14,28,0.85)";
        
        // Stack from bottom up
        const yBase = H - 20 - (gs.events.length - i) * 52;
        
        roundRect(ctx, 16, yBase, 270, 44, 8);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,245,212,0.3)";
        ctx.lineWidth = 1;
        roundRect(ctx, 16, yBase, 270, 44, 8);
        ctx.stroke();
        ctx.fillStyle = "#00f5d4";
        ctx.font = "bold 10px 'Courier New', monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(ev.title, 26, yBase + 16);
        ctx.fillStyle = "rgba(200,210,220,0.8)";
        ctx.font = "9px 'Courier New', monospace";
        ctx.fillText(ev.desc.slice(0, 40), 26, yBase + 32);
        ctx.globalAlpha = 1;
    });

    // Draw combined legend (bottom right)
    const owners = ["player", "ai1", "ai2", "ai3", "neutral"];
    const labels = { player: "YOU", ai1: "ENEMY α", ai2: "ENEMY β", ai3: "ENEMY γ", neutral: "NEUTRAL" };
    
    const legendW = 200;
    const legendH = 145;
    const legendX = W - legendW - 20;
    const legendY = H - legendH - 20;

    ctx.fillStyle = "rgba(8,11,20,0.8)";
    roundRect(ctx, legendX, legendY, legendW, legendH, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    roundRect(ctx, legendX, legendY, legendW, legendH, 12);
    ctx.stroke();

    ctx.fillStyle = "rgba(200,210,220,0.4)";
    ctx.font = "10px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("LEGEND", legendX + 16, legendY + 20);

    owners.forEach((owner, i) => {
        const count = gs.nodes.filter(n => n.owner === owner).length;
        const color = OWNER_COLORS[owner];
        const y = legendY + 40 + i * 16;
        
        // Dot
        ctx.beginPath();
        ctx.arc(legendX + 20, y - 3, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = owner === "player" ? "#00f5d4" : "rgba(200,210,220,0.6)";
        ctx.fillText(labels[owner], legendX + 32, y);

        // Count
        ctx.fillStyle = "rgba(200,210,220,0.8)";
        ctx.textAlign = "right";
        ctx.fillText(`${count} nodes`, legendX + legendW - 16, y);
        ctx.textAlign = "left";
    });

    // Divider
    ctx.beginPath();
    ctx.moveTo(legendX + 16, legendY + 115);
    ctx.lineTo(legendX + legendW - 16, legendY + 115);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();

    // Instructions
    ctx.fillStyle = "rgba(200,210,220,0.3)";
    ctx.font = "9px 'Courier New', monospace";
    ctx.fillText("SCROLL: zoom · DRAG SPACE: pan", legendX + 16, legendY + 130);
    ctx.fillText("CTRL + CLICK ROAD: ambush", legendX + 16, legendY + 142);
}

export function draw(ctx, canvas, gs, ts) {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = "#080b14";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 1;
    const gSize = 40;
    for (let x = 0; x < W; x += gSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += gSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();

    ctx.save();
    const offsetX = (W - 900) / 2, offsetY = (H - 700) / 2;
    ctx.translate(offsetX + gs.panX, offsetY + gs.panY);
    ctx.scale(gs.zoom, gs.zoom);

    drawEdges(ctx, gs, ts);
    drawDragLine(ctx, gs, ts);
    drawNodes(ctx, gs, ts);
    drawSwarms(ctx, gs);
    drawJets(ctx, gs);
    gs.particles.forEach(p => p.draw(ctx));

    ctx.restore();
    drawHUD(ctx, canvas, gs, ts);
}

function drawEdges(ctx, gs, ts) {
    gs.edges.forEach(edge => {
        const na = gs.nodes.find(n => n.id === edge.n1);
        const nb = gs.nodes.find(n => n.id === edge.n2);
        if (!na || !nb) return;

        let routeColor = null;
        let routeAlpha = 0;
        if (gs.mode === "route-select") {
            gs.attackRoutes.forEach((route, idx) => {
                const inRoute = route.path.some((_, i) => i < route.path.length - 1 && ((route.path[i] === na.id && route.path[i + 1] === nb.id) || (route.path[i] === nb.id && route.path[i + 1] === na.id)));
                if (inRoute) {
                    routeColor = idx === gs.hoveredRouteIdx ? "#00ff88" : "#44aa66";
                    routeAlpha = idx === gs.hoveredRouteIdx ? 1 : 0.45;
                }
            });
        }

        let isDragPath = false;
        if (gs.currentDragPath && gs.currentDragPath.length > 1) {
            isDragPath = gs.currentDragPath.some((_, i) => i < gs.currentDragPath.length - 1 && ((gs.currentDragPath[i] === na.id && gs.currentDragPath[i + 1] === nb.id) || (gs.currentDragPath[i] === nb.id && gs.currentDragPath[i + 1] === na.id)));
        }

        ctx.beginPath();
        ctx.moveTo(na.cx, na.cy);
        ctx.lineTo(nb.cx, nb.cy);

        if (routeColor) {
            ctx.globalAlpha = routeAlpha;
            ctx.strokeStyle = routeColor;
            ctx.lineWidth = routeAlpha === 1 ? 5 : 3;
            ctx.setLineDash([12, 8]);
            ctx.lineDashOffset = -(ts / 40) % 20;
            ctx.shadowColor = routeColor;
            ctx.shadowBlur = 12;
        } else if (isDragPath) {
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = "#ff4444";
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 8]);
            ctx.lineDashOffset = -(ts / 30) % 18;
            ctx.shadowColor = "#ff4444";
            ctx.shadowBlur = 8;
        } else if (edge.ambushBy) {
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = OWNER_COLORS[edge.ambushBy];
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 8]);
            ctx.lineDashOffset = -(ts / 40) % 16;
            ctx.shadowColor = OWNER_COLORS[edge.ambushBy];
            ctx.shadowBlur = 6;
        } else {
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = "#4a5568";
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
        }
        ctx.stroke();

        if (!routeColor) {
            const mx = (na.cx + nb.cx) / 2, my = (na.cy + nb.cy) / 2;
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = "#8899aa";
            ctx.font = "9px 'Courier New', monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            // Map weights to a 5-15 range
            ctx.fillText(Math.min(15, Math.max(5, Math.round(edge.weight / 20))), mx, my);
        }

        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        if (edge.ambushBy) {
            const mx = (na.cx + nb.cx) / 2, my = (na.cy + nb.cy) / 2;
            ctx.beginPath();
            ctx.arc(mx, my, 8, 0, Math.PI * 2);
            ctx.fillStyle = OWNER_COLORS[edge.ambushBy];
            ctx.globalAlpha = 0.85;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.font = "11px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("💣", mx, my + 1);
        }
    });
}

function drawDragLine(ctx, gs, ts) {
    if (gs.isDragging && gs.dragPos && gs.selectedNodeId && !gs.currentDragPath) {
        const src = gs.nodes.find(n => n.id === gs.selectedNodeId);
        if (src) {
            ctx.beginPath();
            ctx.moveTo(src.cx, src.cy);
            ctx.lineTo(gs.dragPos.x, gs.dragPos.y);
            ctx.strokeStyle = "rgba(255,255,255,0.3)";
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.lineDashOffset = -(ts / 40) % 16;
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

function drawNodes(ctx, gs, ts) {
    gs.nodes.forEach(node => {
        const isSelected = node.id === gs.selectedNodeId;
        const isTarget = node.id === gs.selectedEnemyId || node.id === gs.dragTargetId;
        const color = OWNER_COLORS[node.owner];
        const glow = OWNER_GLOW[node.owner];
        const r = 24;

        ctx.save();
        ctx.translate(node.cx, node.cy);

        if (isSelected || isTarget) {
            const pulse = 1 + Math.sin(ts / 200) * 0.12;
            ctx.save();
            ctx.scale(pulse, pulse);
            ctx.beginPath();
            ctx.arc(0, 0, r + 12, 0, Math.PI * 2);
            ctx.strokeStyle = isTarget ? "#ff4444" : "#ffffff";
            ctx.lineWidth = 2.5;
            ctx.shadowColor = isTarget ? "#ff2200" : "#00f5d4";
            ctx.shadowBlur = 20;
            ctx.globalAlpha = 0.7;
            ctx.setLineDash([6, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        if (node.isAirbase) {
            ctx.beginPath();
            ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
            ctx.strokeStyle = "#ffd700";
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.5 + 0.3 * Math.sin(ts / 300);
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, color + "ff");
        grad.addColorStop(0.6, color + "cc");
        grad.addColorStop(1, color + "44");
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.shadowColor = glow;
        ctx.shadowBlur = isSelected ? 25 : 12;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(8,11,20,0.75)";
        ctx.shadowBlur = 0;
        ctx.fill();

        ctx.fillStyle = color;
        ctx.font = `bold ${node.troops >= 100 ? 10 : 12}px 'Courier New', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = glow;
        ctx.shadowBlur = 6;
        ctx.fillText(Math.floor(node.troops), 0, 0);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(220,230,240,0.75)";
        ctx.font = "9px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.name.toUpperCase(), 0, r + 5);

        if (node.isAirbase) {
            ctx.fillStyle = "#ffd700";
            ctx.font = "8px sans-serif";
            ctx.fillText("✈", 0, -(r + 14));
        }

        ctx.restore();
    });
}

function drawSwarms(ctx, gs) {
    gs.swarms.forEach(swarm => {
        const color = OWNER_COLORS[swarm.owner];
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        swarm.dots.forEach(dot => {
            if (dot.targetIdx >= swarm.path.length) return;
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, swarm.isJet ? 4 : 3, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;
    });
}

function drawJets(ctx, gs) {
    gs.jets.forEach(jet => {
        const src = gs.nodes.find(n => n.id === jet.srcId);
        const tgt = gs.nodes.find(n => n.id === jet.tgtId);
        if (!src || !tgt) return;
        const s = jet.state === "outward" ? src : tgt;
        const e = jet.state === "outward" ? tgt : src;
        const px = s.cx + (e.cx - s.cx) * jet.progress;
        const py = s.cy + (e.cy - s.cy) * jet.progress;
        const angle = Math.atan2(e.cy - s.cy, e.cx - s.cx);

        ctx.beginPath();
        ctx.moveTo(s.cx + (e.cx - s.cx) * Math.max(0, jet.progress - 0.15), s.cy + (e.cy - s.cy) * Math.max(0, jet.progress - 0.15));
        ctx.lineTo(px, py);
        ctx.strokeStyle = "rgba(255,215,0,0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.fillStyle = "#ffd700";
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 15;
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✈", 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();
    });
}
