import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createGame, allStandings, commandIncome, territoriesOf } from "../engine/state";
import { tick } from "../engine/sim";
import {
    order,
    previewOrder,
    territoryReport,
    fortify,
    buildBarracks,
    buildWatchtower,
    rally,
    togglePause as togglePauseCommand,
} from "../engine/commands";
import { threatTo } from "../engine/armies";
import { MARCH } from "../engine/config";
import { pointInPolygon, dist, clamp, lerp } from "../engine/geometry";

import { buildTerrainLayer } from "../render/terrainLayer";
import { renderScene, MARKER_RADIUS } from "../render/scene";
import {
    createCamera,
    fitToWorld,
    updateCamera,
    screenToWorld,
    worldToScreen,
    zoomAt,
    panBy,
    focusOn,
    addShake,
    throwCamera,
    applyMomentum,
} from "../render/camera";

import TopBar from "./hud/TopBar";
import TerritoryPanel from "./hud/TerritoryPanel";
import CommandBar from "./hud/CommandBar";
import EventFeed, { WorldEventBanner } from "./hud/EventFeed";
import EndScreen from "./EndScreen";
import HowToPlay from "./HowToPlay";
import { sfx, setSoundEnabled, isSoundEnabled } from "../audio/sfx";

const CLICK_SLOP = 6;       // px of movement still counted as a click
const HUD_HZ = 10;

export default function GameScreen({ seed, difficulty, onQuit, onRestart }) {
    const canvasRef = useRef(null);
    const cameraRef = useRef(createCamera());
    const layerRef = useRef(null);
    const viewportRef = useRef({ width: 0, height: 0 });
    const previewRef = useRef(null);
    const pointerRef = useRef({ down: false, mode: null, downAt: null, last: null, sourceIndex: null, pointer: null });
    const selectedRef = useRef(null);
    const hoverRef = useRef(null);
    const fractionRef = useRef(MARCH.defaultSendFraction);
    const seenLogRef = useRef(null);
    // Dispatches are hidden by default, so the unread count is the only signal
    // that something happened. Derived from the log itself — how many entries
    // are newer than the last one the player saw — rather than accumulated, so
    // it stays correct no matter how often the HUD republishes.
    const feedSeenIdRef = useRef(null);

    const [hud, setHud] = useState(null);
    const [showHelp, setShowHelp] = useState(false);
    const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
    // Mirrors pointerRef.mode purely so the cursor can change; the drag itself
    // is driven by the ref so it never waits on a React render.
    const [orderDragging, setOrderDragging] = useState(false);
    const [feedOpen, setFeedOpen] = useState(false);
    // Independent per-card collapse state — each floating card is its own
    // pill, not a slot in a fixed sidebar, so these don't need to agree.
    const [commandCollapsed, setCommandCollapsed] = useState(false);
    const [panelCollapsed, setPanelCollapsed] = useState(false);
    const [feedCollapsed, setFeedCollapsed] = useState(false);

    // ---- Game state ------------------------------------------------------
    // Created once. GameScreen is keyed by session, so a new match remounts
    // rather than mutating this in place.
    const [game] = useState(() => createGame({ seed, difficulty }));

    // ---- Hit testing -----------------------------------------------------
    const territoryAt = useCallback((screenPoint) => {
        const state = game;
        const camera = cameraRef.current;
        const viewport = viewportRef.current;
        const world = screenToWorld(camera, screenPoint, viewport);

        // Markers win over cells so a badge is always clickable, even when it
        // overhangs a neighbouring territory.
        let bestMarker = null;
        let bestDistance = MARKER_RADIUS + 6;
        for (const t of state.territories) {
            if (t.orphan) continue;
            const s = worldToScreen(camera, t.centroid, viewport);
            const d = dist(s, screenPoint);
            if (d < bestDistance) { bestDistance = d; bestMarker = t; }
        }
        if (bestMarker) return bestMarker;

        for (const t of state.territories) {
            if (t.orphan || !t.cell || t.cell.length < 3) continue;
            if (pointInPolygon(world, t.cell)) return t;
        }
        return null;
    }, [game]);

    // ---- HUD snapshot ----------------------------------------------------
    const publishHud = useCallback(() => {
        const state = game;
        if (!state) return;
        const owned = territoriesOf(state, "player");
        const selectedIndex = selectedRef.current;

        let unread = 0;
        for (const entry of state.log) {
            if (entry.id === feedSeenIdRef.current) break;
            unread++;
        }

        setHud({
            standings: allStandings(state),
            command: state.factions.player.command,
            income: commandIncome(state, "player"),
            territories: owned.length,
            supplied: owned.filter((t) => t.supplied).length,
            troops: Math.round(owned.reduce((s, t) => s + t.troops, 0)),
            report: selectedIndex != null ? territoryReport(state, selectedIndex) : null,
            log: state.log.slice(0, 14),
            unread,
            activeEvent: state.activeEvent,
            paused: state.paused,
            outcome: state.outcome,
            time: state.time,
            captures: state.factions.player.captures,
            fraction: fractionRef.current,
        });
    }, [game]);

    // ---- Reactions to what just happened ---------------------------------
    const reactToLog = useCallback(() => {
        const state = game;
        const newest = state.log[0];
        if (!newest || newest.id === seenLogRef.current) return;

        // Walk everything since the last frame we reacted to.
        const fresh = [];
        for (const entry of state.log) {
            if (entry.id === seenLogRef.current) break;
            fresh.push(entry);
        }
        seenLogRef.current = newest.id;

        for (const entry of fresh.reverse()) {
            if (entry.tone === "good" && entry.title.includes("taken")) {
                sfx.capture();
                addShake(cameraRef.current, 0.32);
            } else if (entry.tone === "bad") {
                sfx.lost();
                addShake(cameraRef.current, 0.45);
            } else if (entry.tone === "combat") {
                sfx.battle();
            } else if (entry.tone === "event") {
                sfx.event();
            }
        }
    }, [game]);

    // ---- Main loop -------------------------------------------------------
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const state = game;
        layerRef.current = buildTerrainLayer(state.world);

        let raf = 0;
        let last = performance.now();
        let hudClock = 0;
        let ended = false;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            viewportRef.current = { width, height };
            return dpr;
        };

        let dpr = resize();
        // Open at cover-fit on the player's capital: close enough to read
        // garrisons, with the full-board overview one scroll out.
        fitToWorld(cameraRef.current, state.world, viewportRef.current);
        const capital = state.territories.find((t) => t.isCapital && t.owner === "player");
        if (capital) focusOn(cameraRef.current, capital.centroid, 1.2);

        const onResize = () => { dpr = resize(); };
        window.addEventListener("resize", onResize);

        const frame = (now) => {
            const dt = Math.min((now - last) / 1000, 0.1);
            last = now;

            tick(state, dt);
            reactToLog();
            applyMomentum(cameraRef.current, dt);
            updateCamera(cameraRef.current, state.world, viewportRef.current, dt);

            // Recompute the order preview every frame so the readout tracks
            // garrisons that are growing while you hold the drag.
            const drag = pointerRef.current;
            previewRef.current = (drag.mode === "order" && drag.sourceIndex != null && drag.targetIndex != null)
                ? previewOrder(state, drag.sourceIndex, drag.targetIndex, fractionRef.current)
                : null;
            if (previewRef.current) previewRef.current.pointer = drag.pointer;

            const threats = {};
            for (const t of state.territories) {
                if (t.owner !== "player") continue;
                const incoming = threatTo(state, t.index, "player");
                if (incoming > 0) threats[t.index] = incoming;
            }

            renderScene(ctx, state, {
                camera: cameraRef.current,
                viewport: viewportRef.current,
                dpr,
                terrainLayer: layerRef.current,
                now: state.time,
                selectedIndex: selectedRef.current,
                hoverIndex: hoverRef.current,
                preview: previewRef.current,
                drag: drag.mode === "order" ? drag : null,
                threats,
            });

            hudClock += dt;
            if (hudClock >= 1 / HUD_HZ) {
                hudClock = 0;
                publishHud();
            }

            if (state.outcome && !ended) {
                ended = true;
                if (state.outcome.result === "victory") sfx.victory();
                else sfx.defeat();
                publishHud();
            }

            raf = requestAnimationFrame(frame);
        };

        raf = requestAnimationFrame(frame);
        publishHud();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
        };
    }, [game, publishHud, reactToLog]);

    // ---- Pointer input ---------------------------------------------------
    const handlePointerDown = useCallback((e) => {
        const state = game;
        if (state.outcome) return;
        // Capture keeps a drag alive if the cursor leaves the canvas, but it
        // throws if the pointer is already gone. Losing input entirely because
        // of that would be far worse than losing capture, so it can fail.
        try {
            e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
            /* pointer already released — carry on without capture */
        }

        const point = { x: e.clientX, y: e.clientY };
        const hit = territoryAt(point);
        const p = pointerRef.current;
        p.down = true;
        p.downAt = point;
        p.last = point;
        p.pointer = point;
        p.targetIndex = null;
        p.velX = 0;
        p.velY = 0;
        p.lastMoveAt = performance.now();
        // Grabbing the map stops any momentum still coasting from a previous throw.
        cameraRef.current.velX = 0;
        cameraRef.current.velY = 0;

        // Dragging off your own holding gives an order; anywhere else pans.
        if (hit && hit.owner === "player" && e.button === 0) {
            p.mode = "order";
            p.sourceIndex = hit.index;
            setOrderDragging(true);
        } else {
            p.mode = "pan";
            p.sourceIndex = null;
        }
    }, [game, territoryAt]);

    const handlePointerMove = useCallback((e) => {
        const point = { x: e.clientX, y: e.clientY };
        const p = pointerRef.current;
        const hit = territoryAt(point);
        hoverRef.current = hit?.index ?? null;

        if (!p.down) { p.pointer = point; return; }

        if (p.mode === "pan") {
            panBy(cameraRef.current, point.x - p.last.x, point.y - p.last.y);

            // Track a smoothed instantaneous velocity so a release can throw
            // the camera onward instead of stopping dead under the cursor.
            const now = performance.now();
            const elapsed = Math.max(1, now - (p.lastMoveAt ?? now));
            const vx = ((point.x - p.last.x) / elapsed) * 1000;
            const vy = ((point.y - p.last.y) / elapsed) * 1000;
            p.velX = lerp(p.velX ?? 0, vx, 0.6);
            p.velY = lerp(p.velY ?? 0, vy, 0.6);
            p.lastMoveAt = now;
        } else if (p.mode === "order") {
            p.pointer = point;
            p.targetIndex = hit && hit.index !== p.sourceIndex ? hit.index : null;
        }
        p.last = point;
    }, [territoryAt]);

    const handlePointerUp = useCallback((e) => {
        const state = game;
        const p = pointerRef.current;
        if (!p.down) return;

        const point = { x: e.clientX, y: e.clientY };
        const moved = dist(point, p.downAt);

        if (p.mode === "order" && p.targetIndex != null && moved > CLICK_SLOP) {
            const result = order(state, p.sourceIndex, p.targetIndex, fractionRef.current);
            if (result.ok) sfx.dispatch();
            else sfx.deny();
            selectedRef.current = p.sourceIndex;
        } else if (moved <= CLICK_SLOP) {
            const hit = territoryAt(point);
            selectedRef.current = hit?.index ?? null;
            if (hit) sfx.select();
        } else if (p.mode === "pan") {
            throwCamera(cameraRef.current, p.velX ?? 0, p.velY ?? 0);
        }

        p.down = false;
        p.mode = null;
        p.sourceIndex = null;
        p.targetIndex = null;
        previewRef.current = null;
        setOrderDragging(false);
        publishHud();
    }, [game, territoryAt, publishHud]);

    const handleWheel = useCallback((e) => {
        const p = pointerRef.current;
        // Mid-drag the wheel trims the commitment instead of zooming — it is
        // the one adjustment you want without letting go of the order.
        if (p.mode === "order") {
            const step = e.deltaY > 0 ? -0.05 : 0.05;
            fractionRef.current = clamp(fractionRef.current + step, MARCH.minSendFraction, MARCH.maxSendFraction);
            publishHud();
            return;
        }
        zoomAt(cameraRef.current, { x: e.clientX, y: e.clientY }, e.deltaY, viewportRef.current);
    }, [publishHud]);

    // ---- Keyboard --------------------------------------------------------
    useEffect(() => {
        const onKey = (e) => {
            const state = game;
            if (!state || e.target.tagName === "INPUT") return;
            const key = e.key.toLowerCase();

            if (key === " ") {
                e.preventDefault();
                state.paused = !state.paused;
                publishHud();
            } else if (key === "escape") {
                selectedRef.current = null;
                setShowHelp(false);
                publishHud();
            } else if (key === "?" || key === "/") {
                setShowHelp((v) => !v);
            } else if (selectedRef.current != null) {
                const index = selectedRef.current;
                const actions = { f: fortify, b: buildBarracks, t: buildWatchtower, r: rally };
                if (actions[key]) {
                    const result = actions[key](state, index);
                    if (result?.ok) sfx.build();
                    else sfx.deny();
                    publishHud();
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [game, publishHud]);

    // ---- Build handlers --------------------------------------------------
    const runBuild = useCallback((fn) => (index) => {
        const result = fn(game, index);
        if (result?.ok) sfx.build();
        else sfx.deny();
        publishHud();
    }, [game, publishHud]);

    const buildHandlers = useMemo(() => ({
        onFortify: runBuild(fortify),
        onBarracks: runBuild(buildBarracks),
        onWatchtower: runBuild(buildWatchtower),
        onRally: runBuild(rally),
    }), [runBuild]);

    const toggleSound = () => {
        const next = !soundOn;
        setSoundOn(next);
        setSoundEnabled(next);
        if (next) sfx.select();
    };

    const togglePause = () => {
        togglePauseCommand(game);
        publishHud();
    };

    const toggleFeed = () => {
        const next = !feedOpen;
        setFeedOpen(next);
        // Opening marks everything currently in the log as seen.
        if (next) feedSeenIdRef.current = game.log[0]?.id ?? null;
        publishHud();
    };

    return (
        <div className="game">
            <canvas
                ref={canvasRef}
                className={`game-canvas${orderDragging ? " is-dragging-order" : ""}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
            />

            {hud && (
                <>
                    <TopBar
                        standings={hud.standings}
                        seed={seed}
                        paused={hud.paused}
                        soundOn={soundOn}
                        unread={hud.unread}
                        feedOpen={feedOpen}
                        onTogglePause={togglePause}
                        onToggleSound={toggleSound}
                        onToggleFeed={toggleFeed}
                        onHelp={() => setShowHelp(true)}
                        onQuit={onQuit}
                    />

                    <WorldEventBanner event={hud.activeEvent} />

                    {/* Every card below is independently positioned and
                        independently collapsible — none of them are slots in
                        a fixed sidebar, so the map stays the whole screen. */}
                    <EventFeed
                        entries={hud.log}
                        open={feedOpen}
                        collapsed={feedCollapsed}
                        onToggleCollapse={() => setFeedCollapsed((v) => !v)}
                        onClose={toggleFeed}
                    />

                    <CommandBar
                        command={hud.command}
                        income={hud.income}
                        fraction={hud.fraction}
                        onFraction={(v) => { fractionRef.current = v; publishHud(); }}
                        territories={hud.territories}
                        troops={hud.troops}
                        supplied={hud.supplied}
                        collapsed={commandCollapsed}
                        onToggleCollapse={() => setCommandCollapsed((v) => !v)}
                    />

                    <TerritoryPanel
                        report={hud.report}
                        command={hud.command}
                        handlers={buildHandlers}
                        collapsed={panelCollapsed}
                        onToggleCollapse={() => setPanelCollapsed((v) => !v)}
                        onClose={() => { selectedRef.current = null; publishHud(); }}
                    />

                    {!hud.report && (
                        <div className="hint">
                            Drag from one of <strong>your</strong> holdings to give an order · scroll to zoom · <strong>space</strong> to pause
                        </div>
                    )}

                    {hud.paused && !hud.outcome && (
                        <div className="veil"><span className="veil-word">PAUSED</span></div>
                    )}

                    {hud.outcome && (
                        <EndScreen
                            outcome={hud.outcome}
                            stats={{
                                territories: hud.territories,
                                captures: hud.captures,
                                duration: `${Math.floor(hud.time / 60)}m ${String(Math.floor(hud.time % 60)).padStart(2, "0")}s`,
                            }}
                            onRestart={onRestart}
                            onQuit={onQuit}
                        />
                    )}
                </>
            )}

            {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
        </div>
    );
}
