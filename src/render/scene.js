// ============================================================
// Frame rendering.
//
// Two passes:
//   world space  — terrain, ownership, borders, roads, ground effects
//   screen space — markers, army tokens, labels, the drag order UI
//
// Markers live in screen space on purpose: at any zoom a garrison badge
// stays the same readable size, so the map never becomes a wall of tiny
// numbers or a handful of giant discs.
// ============================================================

import { PALETTE, rgba, FONT } from "./palette";
import { worldToScreen } from "./camera";
import { faction as factionOf } from "../engine/config";
import { knownTroops, capacityOf } from "../engine/state";
import { armyPosition, isInDisorder } from "../engine/armies";
import { clamp, clamp01, smoothstep, lerp } from "../engine/geometry";

const MARKER_RADIUS = 21;

function tracePolygon(ctx, poly) {
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
}

const ownerColor = (id) => factionOf(id).color;

// ---- World-space layers --------------------------------------------------

function drawOwnership(ctx, state, now) {
    for (const t of state.territories) {
        if (!t.cell || t.cell.length < 3) continue;
        const isNeutral = t.owner === "neutral";
        const color = ownerColor(t.owner);

        ctx.save();
        tracePolygon(ctx, t.cell);
        ctx.clip();

        // Faction dye: strongest at the seat of the territory, fading outward.
        // Kept deliberately light — terrain has to stay legible underneath it,
        // because terrain is what the player's decisions actually turn on.
        const radius = 210;
        const g = ctx.createRadialGradient(
            t.centroid.x, t.centroid.y, 8,
            t.centroid.x, t.centroid.y, radius,
        );
        g.addColorStop(0, rgba(color, isNeutral ? 0.1 : 0.4));
        g.addColorStop(0.5, rgba(color, isNeutral ? 0.06 : 0.2));
        g.addColorStop(1, rgba(color, isNeutral ? 0.02 : 0.06));
        ctx.fillStyle = g;
        ctx.fillRect(t.centroid.x - radius, t.centroid.y - radius, radius * 2, radius * 2);

        // A holding that just changed hands flares briefly.
        const sinceCapture = now - (t.lastCaptureAt ?? -99);
        if (sinceCapture >= 0 && sinceCapture < 1.6) {
            const k = 1 - sinceCapture / 1.6;
            ctx.fillStyle = rgba(color, 0.5 * k * k);
            ctx.fillRect(t.centroid.x - 260, t.centroid.y - 260, 520, 520);
        }

        // Cut off from its capital: a sickly red wash that pulses.
        if (!isNeutral && !t.supplied) {
            const pulse = 0.16 + Math.sin(now * 3.4 + t.index) * 0.07;
            ctx.fillStyle = rgba(PALETTE.cutoff, pulse);
            ctx.fillRect(t.centroid.x - 260, t.centroid.y - 260, 520, 520);
        }

        ctx.restore();
    }
}

function drawFrontLines(ctx, state, now) {
    for (const road of state.roads) {
        const a = state.territories[road.a];
        const b = state.territories[road.b];
        if (a.owner === b.owner || !road.segment) continue;
        // Only contested where two *powers* meet; neutral ground is quiet.
        const contested = a.owner !== "neutral" && b.owner !== "neutral";

        const [p, q] = road.segment;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);

        if (contested) {
            const heat = 0.55 + Math.sin(now * 2.6 + road.a) * 0.2;
            ctx.strokeStyle = rgba(PALETTE.hot, heat);
            ctx.lineWidth = 5;
            ctx.shadowColor = rgba(PALETTE.hot, 0.55);
            ctx.shadowBlur = 14;
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else {
            ctx.strokeStyle = rgba(PALETTE.ink, 0.16);
            ctx.lineWidth = 2.4;
            ctx.stroke();
        }
    }
}

function drawRoads(ctx, state, now, view) {
    for (const road of state.roads) {
        const a = state.territories[road.a];
        const b = state.territories[road.b];
        const sameOwner = a.owner === b.owner && a.owner !== "neutral";
        const playerRoad = sameOwner && a.owner === "player";

        ctx.beginPath();
        ctx.moveTo(a.centroid.x, a.centroid.y);
        ctx.lineTo(b.centroid.x, b.centroid.y);
        ctx.strokeStyle = rgba("#05070A", 0.72);
        ctx.lineWidth = 7;
        ctx.stroke();

        // Roads you control read as solid arteries; everything else is a
        // dashed track, so your own network is legible at a glance.
        ctx.strokeStyle = sameOwner
            ? rgba(ownerColor(a.owner), 0.75)
            : rgba(PALETTE.parchment, 0.4);
        ctx.lineWidth = 2.6;
        ctx.setLineDash(sameOwner ? [] : [8, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Supply pulses run along your own connected roads — a living readout
        // of which parts of your realm are actually joined up.
        if (playerRoad && a.supplied && b.supplied && view.camera.zoom > 0.4) {
            const t = ((now * 0.28) + road.a * 0.13) % 1;
            const x = lerp(a.centroid.x, b.centroid.x, t);
            const y = lerp(a.centroid.y, b.centroid.y, t);
            const fade = Math.sin(t * Math.PI);
            ctx.beginPath();
            ctx.arc(x, y, 3.2, 0, Math.PI * 2);
            ctx.fillStyle = rgba(PALETTE.gold, 0.55 * fade);
            ctx.fill();
        }
    }
}

function drawRoutePreview(ctx, state, view) {
    const preview = view.preview;
    if (!preview?.route || preview.route.length < 2) return;

    const valid = preview.valid;
    const color = valid
        ? (preview.kind === "reinforce" ? PALETTE.good : preview.outcome?.captures ? PALETTE.gold : PALETTE.danger)
        : PALETTE.inkFaint;

    ctx.beginPath();
    const first = state.territories[preview.route[0]].centroid;
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < preview.route.length; i++) {
        const c = state.territories[preview.route[i]].centroid;
        ctx.lineTo(c.x, c.y);
    }
    ctx.strokeStyle = rgba(color, 0.9);
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 9]);
    ctx.lineDashOffset = -view.now * 40;
    ctx.shadowColor = rgba(color, 0.6);
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.shadowBlur = 0;
}

function drawGroundEffects(ctx, state, now) {
    for (const fx of state.effects) {
        const age = (now - fx.born) / fx.life;
        if (age < 0 || age > 1) continue;
        const at = fx.at;
        const color = fx.owner ? ownerColor(fx.owner) : PALETTE.hot;

        if (fx.kind === "capture" || fx.kind === "dispatch" || fx.kind === "build" || fx.kind === "rally") {
            const r = lerp(10, fx.kind === "capture" ? 150 : 60, smoothstep(age));
            ctx.beginPath();
            ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(color, (1 - age) * 0.75);
            ctx.lineWidth = lerp(6, 1, age);
            ctx.stroke();
        } else if (fx.kind === "clash" || fx.kind === "repelled" || fx.kind === "revolt") {
            const r = lerp(6, 74, smoothstep(age));
            ctx.beginPath();
            ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(fx.kind === "revolt" ? PALETTE.gold : PALETTE.danger, (1 - age) * 0.85);
            ctx.lineWidth = lerp(7, 1, age);
            ctx.stroke();
            // Sparks
            const spokes = 8;
            for (let i = 0; i < spokes; i++) {
                const a = (i / spokes) * Math.PI * 2 + fx.born;
                const inner = r * 0.6;
                const outer = r * (0.9 + (i % 3) * 0.12);
                ctx.beginPath();
                ctx.moveTo(at.x + Math.cos(a) * inner, at.y + Math.sin(a) * inner);
                ctx.lineTo(at.x + Math.cos(a) * outer, at.y + Math.sin(a) * outer);
                ctx.strokeStyle = rgba(PALETTE.hot, (1 - age) * 0.7);
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }
}

// ---- Screen-space layers -------------------------------------------------

function drawCapitalCrown(ctx, x, y, color) {
    ctx.beginPath();
    const w = 13;
    const h = 8;
    ctx.moveTo(x - w / 2, y + h / 2);
    ctx.lineTo(x - w / 2, y - h / 2);
    ctx.lineTo(x - w / 4, y);
    ctx.lineTo(x, y - h / 1.5);
    ctx.lineTo(x + w / 4, y);
    ctx.lineTo(x + w / 2, y - h / 2);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function drawUpgradePips(ctx, t, x, y) {
    const pips = [];
    for (let i = 0; i < t.fort; i++) pips.push(PALETTE.gold);
    if (t.barracks) pips.push(PALETTE.good);
    if (t.watchtower) pips.push("#7FB3C4");
    if (!pips.length) return;

    const spacing = 7;
    const startX = x - ((pips.length - 1) * spacing) / 2;
    pips.forEach((color, i) => {
        ctx.beginPath();
        ctx.arc(startX + i * spacing, y, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    });
}

function drawMarker(ctx, state, t, view) {
    const screen = worldToScreen(view.camera, t.centroid, view.viewport);
    const { now } = view;
    const color = ownerColor(t.owner);
    const isPlayer = t.owner === "player";
    const known = knownTroops(t);
    const selected = view.selectedIndex === t.index;
    const hovered = view.hoverIndex === t.index;
    const isTarget = view.preview?.target?.index === t.index;
    const isSource = view.preview?.source?.index === t.index;

    // Your own holdings and known enemies sit at full size; unclaimed and
    // unscouted ground is smaller and quieter, so your network reads first.
    const prominence = isPlayer ? 1 : t.owner === "neutral" ? 0.82 : 0.92;
    const radius = MARKER_RADIUS * prominence * (selected || isTarget ? 1.13 : hovered ? 1.06 : 1);

    // Threat ring: something hostile is inbound.
    const threat = view.threats?.[t.index] ?? 0;
    if (threat > 0) {
        const pulse = 0.5 + Math.sin(now * 5) * 0.3;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius + 9, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(PALETTE.danger, pulse);
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    // Valid drag target halo.
    if (isTarget && view.preview) {
        const good = view.preview.valid && (view.preview.kind === "reinforce" || view.preview.outcome?.captures);
        const ringColor = !view.preview.valid ? PALETTE.inkFaint : good ? PALETTE.gold : PALETTE.danger;
        const pulse = 0.6 + Math.sin(now * 6) * 0.25;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius + 13 + Math.sin(now * 6) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(ringColor, pulse);
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    if (selected || isSource) {
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius + 7, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(PALETTE.gold, 0.9);
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    // Body
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = rgba("#080B11", 0.92);
    ctx.fill();

    // Owner ring — thicker and brighter for the player's own holdings.
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = t.owner === "neutral" ? rgba(color, 0.55) : color;
    ctx.lineWidth = isPlayer ? 3.2 : 2.4;
    ctx.stroke();

    // Fill fraction ring: how close this garrison is to its ceiling.
    if (known.known && t.owner !== "neutral") {
        const fullness = clamp01(known.value / capacityOf(t));
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius - 4.5, -Math.PI / 2, -Math.PI / 2 + fullness * Math.PI * 2);
        ctx.strokeStyle = rgba(color, 0.45);
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Garrison count — or a question mark where scouts haven't reached.
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (known.known) {
        ctx.font = `700 ${known.stale ? 14 : 16}px ${FONT.numeric}`;
        ctx.fillStyle = known.stale ? PALETTE.inkSoft : PALETTE.ink;
        ctx.fillText(String(known.value), screen.x, screen.y + 0.5);
        if (known.stale) {
            // Mark stale intel so a remembered number is never mistaken for a live one.
            ctx.font = `600 9px ${FONT.ui}`;
            ctx.fillStyle = PALETTE.inkFaint;
            ctx.fillText("?", screen.x + 13, screen.y - 10);
        }
    } else {
        ctx.font = `700 17px ${FONT.numeric}`;
        ctx.fillStyle = PALETTE.inkFaint;
        ctx.fillText("?", screen.x, screen.y + 0.5);
    }

    if (t.isCapital) drawCapitalCrown(ctx, screen.x, screen.y - radius - 7, color);
    drawUpgradePips(ctx, t, screen.x, screen.y + radius + 8);

    // Regrouping clock after a capture.
    if (isPlayer && isInDisorder(state, t)) {
        const left = (t.disorderUntil - state.time);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius + 3, -Math.PI / 2, -Math.PI / 2 + (left / 8) * Math.PI * 2);
        ctx.strokeStyle = rgba(PALETTE.inkSoft, 0.7);
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Names appear once there is room for them, so a zoomed-out map stays a
    // map rather than a wall of labels.
    if (view.camera.zoom > 0.78 || selected || hovered || isTarget) {
        ctx.font = `600 10px ${FONT.ui}`;
        ctx.textAlign = "center";
        const label = t.name.toUpperCase();
        const width = ctx.measureText(label).width;
        const ly = screen.y + radius + (t.fort || t.barracks || t.watchtower ? 20 : 15);

        ctx.fillStyle = rgba("#070A0F", 0.72);
        ctx.fillRect(screen.x - width / 2 - 5, ly - 8, width + 10, 14);
        ctx.fillStyle = selected || hovered ? PALETTE.ink : PALETTE.inkSoft;
        ctx.fillText(label, screen.x, ly);
    }
}

function drawArmy(ctx, state, army, view) {
    const world = armyPosition(state, army);
    const screen = worldToScreen(view.camera, world, view.viewport);
    const color = ownerColor(army.owner);

    // Enemy columns are only visible where you have eyes.
    if (army.owner !== "player") {
        const from = state.territories[army.path[army.leg]];
        const to = state.territories[army.path[army.leg + 1]];
        if (!from?.visible && !to?.visible) return;
    }

    const from = state.territories[army.path[army.leg]];
    const to = state.territories[army.path[army.leg + 1]];
    const angle = Math.atan2(to.centroid.y - from.centroid.y, to.centroid.x - from.centroid.x);

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(angle);

    // Motion trail
    const trail = ctx.createLinearGradient(-26, 0, 0, 0);
    trail.addColorStop(0, rgba(color, 0));
    trail.addColorStop(1, rgba(color, 0.5));
    ctx.fillStyle = trail;
    ctx.fillRect(-26, -2.5, 26, 5);

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-7, -7.5);
    ctx.lineTo(-3.5, 0);
    ctx.lineTo(-7, 7.5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = rgba("#070A0F", 0.85);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();

    // Strength badge
    const count = String(Math.round(army.troops));
    ctx.font = `700 11px ${FONT.numeric}`;
    const w = ctx.measureText(count).width + 10;
    ctx.fillStyle = rgba("#070A0F", 0.88);
    ctx.beginPath();
    ctx.roundRect(screen.x - w / 2, screen.y - 24, w, 15, 4);
    ctx.fill();
    ctx.strokeStyle = rgba(color, 0.8);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count, screen.x, screen.y - 16);
}

/** The order readout that follows the cursor while dragging. */
function drawDragCallout(ctx, view) {
    const preview = view.preview;
    if (!preview || !view.drag?.pointer) return;
    const { x, y } = view.drag.pointer;

    const lines = [];
    if (preview.kind === "reinforce") {
        lines.push({ text: `REINFORCE ${preview.target.name.toUpperCase()}`, color: PALETTE.good, weight: 700, size: 11 });
        lines.push({ text: preview.resultText, color: PALETTE.ink, weight: 600, size: 13 });
    } else {
        const good = preview.outcome?.captures;
        lines.push({ text: `ATTACK ${preview.target.name.toUpperCase()}`, color: PALETTE.gold, weight: 700, size: 11 });
        lines.push({
            text: preview.resultText,
            color: preview.blocked ? PALETTE.inkSoft : !preview.known ? PALETTE.inkSoft : good ? PALETTE.good : PALETTE.danger,
            weight: 700,
            size: 13,
        });
        if (preview.severs > 0) {
            lines.push({ text: `SEVERS ${preview.severs} HOLDING${preview.severs > 1 ? "S" : ""}`, color: PALETTE.hot, weight: 700, size: 11 });
        }
    }
    lines.push({
        text: `${preview.troops} sent · ${preview.arriving} arrive · ${Math.ceil(preview.duration)}s`,
        color: PALETTE.inkSoft,
        weight: 500,
        size: 11,
    });

    let width = 0;
    for (const line of lines) {
        ctx.font = `${line.weight} ${line.size}px ${FONT.ui}`;
        width = Math.max(width, ctx.measureText(line.text).width);
    }
    const padding = 12;
    const lineHeight = 17;
    const boxW = width + padding * 2;
    const boxH = lines.length * lineHeight + padding * 1.6;
    // Keep the callout on screen near the edges.
    const bx = clamp(x + 22, 8, view.viewport.width - boxW - 8);
    const by = clamp(y - boxH - 14, 8, view.viewport.height - boxH - 8);

    ctx.fillStyle = rgba("#070A0F", 0.93);
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = rgba(PALETTE.gold, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) => {
        ctx.font = `${line.weight} ${line.size}px ${FONT.ui}`;
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, bx + padding, by + padding * 0.8 + lineHeight * (i + 0.5));
    });
}

/**
 * Faint diagonal rule across the whole viewport. Only really noticeable in
 * the margin when the player zooms out past the board, which is exactly where
 * a flat black rectangle would look like a rendering fault.
 */
function drawTableTexture(ctx, view) {
    const { viewport, camera } = view;
    const spacing = 46;
    // Drift with the camera so the surface feels attached to the world.
    const offset = ((-camera.x - camera.y) * camera.zoom) % spacing;
    const span = viewport.width + viewport.height;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.014)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -viewport.height; i < span; i += spacing) {
        const x = i + offset;
        ctx.moveTo(x, 0);
        ctx.lineTo(x - viewport.height, viewport.height);
    }
    ctx.stroke();
    ctx.restore();
}

// ---- Entry point ---------------------------------------------------------

export function renderScene(ctx, state, view) {
    const { viewport, dpr, camera, terrainLayer, now } = view;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    // --- The table --------------------------------------------------------
    // Visible whenever the player pulls back past the edge of the board, so it
    // has to read as a surface the map is sitting on, not as empty space.
    const bg = ctx.createRadialGradient(
        viewport.width / 2, viewport.height / 2, 0,
        viewport.width / 2, viewport.height / 2, Math.max(viewport.width, viewport.height) * 0.75,
    );
    bg.addColorStop(0, PALETTE.voidWarm);
    bg.addColorStop(1, PALETTE.void);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    drawTableTexture(ctx, view);

    // --- World space ------------------------------------------------------
    const shakeX = camera.shake ? (Math.random() - 0.5) * camera.shake * 14 : 0;
    const shakeY = camera.shake ? (Math.random() - 0.5) * camera.shake * 14 : 0;

    // The DPR scale is already on the transform, so everything below is in
    // CSS pixels; only the camera scale is applied here.
    ctx.save();
    ctx.translate(viewport.width / 2 + shakeX, viewport.height / 2 + shakeY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Lift the board off the table so the dark margin around it reads as
    // depth rather than as the renderer having run out of map.
    const { width: boardW, height: boardH } = state.world;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 70 / camera.zoom;
    ctx.shadowOffsetY = 22 / camera.zoom;
    ctx.fillStyle = "#05070A";
    ctx.fillRect(0, 0, boardW, boardH);
    ctx.restore();

    if (terrainLayer) {
        ctx.drawImage(terrainLayer.canvas, 0, 0, boardW, boardH);
    }

    // Cells are already clipped to the board when they are generated, so the
    // only clip needed here is the board rectangle itself.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, state.world.width, state.world.height);
    ctx.clip();
    drawOwnership(ctx, state, now);
    drawRoads(ctx, state, now, view);
    drawFrontLines(ctx, state, now);
    ctx.restore();

    drawRoutePreview(ctx, state, view);
    drawGroundEffects(ctx, state, now);

    // A thin lit rule around the board — the edge of the campaign table.
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeStyle = rgba(PALETTE.gold, 0.28);
    ctx.strokeRect(0, 0, boardW, boardH);

    ctx.restore();

    // --- Screen space -----------------------------------------------------
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.translate(shakeX, shakeY);

    for (const t of state.territories) {
        if (t.orphan) continue;
        drawMarker(ctx, state, t, view);
    }
    for (const army of state.armies) {
        drawArmy(ctx, state, army, view);
    }
    ctx.restore();

    drawDragCallout(ctx, view);

    // Vignette to seat the map on the table.
    const vignette = ctx.createRadialGradient(
        viewport.width / 2, viewport.height / 2, Math.min(viewport.width, viewport.height) * 0.42,
        viewport.width / 2, viewport.height / 2, Math.max(viewport.width, viewport.height) * 0.78,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
}

export { MARKER_RADIUS };
