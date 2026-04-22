import { TROOP_REGEN_RATE, SWARM_SPEED_BASE, JET_SPEED, OWNER_COLORS, AI_TICK, EVENT_INTERVAL } from './constants';
import { Particle } from './Particle';
import { pushEvent } from './worldEvents';
import { processAI } from './ai';
import { triggerWorldEvent } from './worldEvents';

// ============================================================
// WIN/LOSS
// ============================================================
function checkWinLoss(gs, setUI) {
    if (gs.gameOver) return;
    const owners = new Set(gs.nodes.filter(n => n.owner !== "neutral").map(n => n.owner));
    gs.swarms.forEach(s => owners.add(s.owner));

    if (!owners.has("player")) {
        gs.gameOver = true; gs.winner = null;
        setUI(u => ({ ...u, phase: "gameover", won: false }));
    } else if (owners.size === 1 && owners.has("player")) {
        gs.gameOver = true; gs.winner = "player";
        setUI(u => ({ ...u, phase: "gameover", won: true }));
    }
}

// ============================================================
// UPDATE
// ============================================================
export function update(gs, dt, ts, setUI) {
    // Troop regen
    gs.nodes.forEach(n => {
        if (n.owner !== "neutral" && n.troops < n.maxTroops) {
            n.troops = Math.min(n.maxTroops, n.troops + TROOP_REGEN_RATE * dt);
        }
    });

    // Update swarms
    for (let si = gs.swarms.length - 1; si >= 0; si--) {
        const swarm = gs.swarms[si];
        let anyAlive = false;

        for (let di = swarm.dots.length - 1; di >= 0; di--) {
            const dot = swarm.dots[di];
            if (dot.targetIdx >= swarm.path.length) continue;
            anyAlive = true;

            const targetId = swarm.path[dot.targetIdx];
            const tNode = gs.nodes.find(n => n.id === targetId);
            if (!tNode) continue;

            const tx = tNode.cx + dot.ox;
            const ty = tNode.cy + dot.oy;
            const dx = tx - dot.x, dy = ty - dot.y;
            const dist = Math.hypot(dx, dy);

            const speed = (swarm.isJet ? JET_SPEED : SWARM_SPEED_BASE);
            if (dist < 8) {
                // Check ambush on the edge just traversed
                if (dot.targetIdx > 0) {
                    const prevId = swarm.path[dot.targetIdx - 1];
                    const edge = gs.edges.find(e => (e.n1 === prevId && e.n2 === targetId) || (e.n2 === prevId && e.n1 === targetId));
                    if (edge && edge.ambushBy && edge.ambushBy !== swarm.owner) {
                        // Kill half the remaining dots
                        const toKill = Math.ceil(swarm.dots.length / 2);
                        const killed = swarm.dots.splice(0, toKill);
                        edge.ambushBy = null;
                        // Spawn particles
                        killed.forEach(d => { for (let k = 0; k < 3; k++) gs.particles.push(new Particle(d.x, d.y, "#ff4444")); });
                        pushEvent(gs, "💣 AMBUSH TRIGGERED!", `A swarm was caught in the trap and lost ${toKill} units!`);
                        break;
                    }
                }
                dot.targetIdx++;

                // Arrived at final target
                if (dot.targetIdx >= swarm.path.length) {
                    const finalId = swarm.path[swarm.path.length - 1];
                    const finalNode = gs.nodes.find(n => n.id === finalId);
                    if (finalNode) {
                        swarm.arrivedTotal++;
                        if (finalNode.owner === swarm.owner) {
                            finalNode.troops = Math.min(finalNode.maxTroops, finalNode.troops + 1);
                        } else {
                            finalNode.troops -= 1;
                            if (finalNode.troops <= 0) {
                                const wasOwner = finalNode.owner;
                                finalNode.owner = swarm.owner;
                                finalNode.troops = Math.abs(finalNode.troops);
                                finalNode.isAirbase = false;
                                // Conquest particles
                                for (let k = 0; k < 15; k++) gs.particles.push(new Particle(finalNode.cx, finalNode.cy, OWNER_COLORS[swarm.owner]));
                                if (swarm.owner === "player" || wasOwner === "player") {
                                    pushEvent(gs, swarm.owner === "player" ? "⚔️ NODE CAPTURED!" : "🔥 NODE LOST!", `${finalNode.name} changed hands!`);
                                }
                            }
                        }
                        swarm.dots.splice(di, 1);
                    }
                }
            } else {
                const wander = Math.sin(ts / 800 + dot.seed) * 12;
                dot.x += ((dx / dist) * speed + wander) * dt;
                dot.y += ((dy / dist) * speed + wander * 0.5) * dt;
            }
        }

        if (swarm.dots.length === 0) gs.swarms.splice(si, 1);
    }

    // Update jets
    for (let ji = gs.jets.length - 1; ji >= 0; ji--) {
        const jet = gs.jets[ji];
        const src = gs.nodes.find(n => n.id === jet.srcId);
        const tgt = gs.nodes.find(n => n.id === jet.tgtId);
        if (!src || !tgt) { gs.jets.splice(ji, 1); continue; }
        if (!src.isAirbase) { gs.jets.splice(ji, 1); continue; }

        jet.progress += (JET_SPEED / Math.hypot(tgt.cx - src.cx, tgt.cy - src.cy)) * dt;
        if (jet.progress >= 1) {
            if (jet.state === "outward") {
                tgt.troops = Math.max(0, tgt.troops - 25);
                for (let k = 0; k < 12; k++) gs.particles.push(new Particle(tgt.cx, tgt.cy, "#ffd700"));
                pushEvent(gs, "✈️ AIRSTRIKE HIT!", `${tgt.name} took 25 damage from airstrike!`);
                jet.state = "returning"; jet.progress = 0;
            } else {
                gs.jets.splice(ji, 1);
            }
        }
    }

    // Particles
    for (let pi = gs.particles.length - 1; pi >= 0; pi--) {
        gs.particles[pi].update(dt);
        if (gs.particles[pi].life <= 0) gs.particles.splice(pi, 1);
    }

    // Events expire
    const now = Date.now();
    gs.events = gs.events.filter(e => now < e.expiresAt);

    // Troop generation tick
    gs.aiTick += dt * 1000;
    if (gs.aiTick >= AI_TICK) {
        gs.aiTick = 0;
        processAI(gs);
    }

    // Random events
    gs.eventTick += dt * 1000;
    if (gs.eventTick >= EVENT_INTERVAL) {
        gs.eventTick = 0;
        triggerWorldEvent(gs);
    }

    // Win/loss check
    checkWinLoss(gs, setUI);
}
