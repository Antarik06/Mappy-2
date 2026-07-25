import { useEffect, useRef } from "react";

import { createGame, refreshIntel } from "../engine/state";
import { tick } from "../engine/sim";
import { buildTerrainLayer } from "../render/terrainLayer";
import { renderScene } from "../render/scene";
import { createCamera, fitToWorld, focusOn, updateCamera } from "../render/camera";
import { randomSeedString } from "../engine/rng";

// The backdrop is a real match, played at speed by four AI commanders.
const DEMO_SPEED = 2.6;
// How long the camera lingers before it looks for the next flashpoint.
const CUT_INTERVAL = 6.5;
// Warm-up ticks so the map opens mid-war rather than at turn zero.
const WARMUP_SECONDS = 75;
const BACKDROP_ZOOM = 1.22;
// The hero copy sits over the left of the screen, so the camera aims a little
// left of the fighting — which pushes the fighting itself into the clear.
const FOCUS_BIAS_X = 0.15;

/**
 * Builds a fresh demo match: real worldgen, real AI, no player.
 * Everything is revealed — a spectator has no fog.
 */
function startDemoMatch(seed) {
    const game = createGame({ seed, difficulty: "warlord", aiCount: 3 });
    game.demoMode = true;
    game.speed = DEMO_SPEED;

    // Fast-forward past the opening land grab so the first frame already has
    // front lines, armies on the road and territory changing hands.
    for (let i = 0; i < WARMUP_SECONDS * 30; i++) tick(game, 1 / 30);
    return game;
}

/** Spectators see everything; the fog only exists for a real player. */
function revealAll(game) {
    for (const t of game.territories) t.visible = true;
}

/**
 * Pick somewhere worth looking at: the most recent fighting, falling back to
 * the busiest front line, then to any army on the march.
 */
function findFlashpoint(game) {
    const recentFight = [...game.effects]
        .reverse()
        .find((fx) => fx.kind === "clash" || fx.kind === "capture" || fx.kind === "repelled");
    if (recentFight) return recentFight.at;

    // Contested borders: two different powers sharing a road.
    const fronts = game.roads.filter((r) => {
        const a = game.territories[r.a];
        const b = game.territories[r.b];
        return a.owner !== b.owner && a.owner !== "neutral" && b.owner !== "neutral";
    });
    if (fronts.length) {
        const road = fronts[Math.floor(Math.random() * fronts.length)];
        const a = game.territories[road.a].centroid;
        const b = game.territories[road.b].centroid;
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    if (game.armies.length) {
        const army = game.armies[Math.floor(Math.random() * game.armies.length)];
        return game.territories[army.path[army.leg]].centroid;
    }
    return null;
}

export default function BattleBackdrop() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        let game = startDemoMatch(randomSeedString());
        let layer = buildTerrainLayer(game.world);
        let camera = createCamera();
        let viewport = { width: 0, height: 0 };
        let dpr = 1;
        let cutTimer = 0;
        let raf = 0;
        let last = performance.now();

        const resize = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (!width || !height) return;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            viewport = { width, height };
            fitToWorld(camera, game.world, viewport);
            // A little closer than cover-fit: enough that marching armies and
            // garrisons read as action, wide enough to still look like a war.
            camera.targetZoom = camera.zoom * BACKDROP_ZOOM;
        };

        resize();
        window.addEventListener("resize", resize);

        const restart = () => {
            game = startDemoMatch(randomSeedString());
            layer = buildTerrainLayer(game.world);
            camera = createCamera();
            fitToWorld(camera, game.world, viewport);
            camera.targetZoom = camera.zoom * BACKDROP_ZOOM;
            cutTimer = 0;
        };

        const frame = (now) => {
            const dt = Math.min((now - last) / 1000, 0.1);
            last = now;

            if (viewport.width) {
                tick(game, dt);
                revealAll(game);
                refreshIntel(game, "player");
                revealAll(game);

                // One side has won — roll a new front so the menu never idles.
                if (game.outcome) restart();

                cutTimer -= dt;
                if (cutTimer <= 0) {
                    cutTimer = CUT_INTERVAL;
                    const target = findFlashpoint(game);
                    if (target) {
                        // Offset in world units, so the bias holds at any zoom.
                        const shift = (viewport.width * FOCUS_BIAS_X) / camera.zoom;
                        focusOn(camera, { x: target.x - shift, y: target.y });
                    }
                }

                updateCamera(camera, game.world, viewport, dt);

                renderScene(ctx, game, {
                    camera,
                    viewport,
                    dpr,
                    terrainLayer: layer,
                    now: game.time,
                    selectedIndex: null,
                    hoverIndex: null,
                    preview: null,
                    drag: null,
                    threats: {},
                });
            }

            raf = requestAnimationFrame(frame);
        };

        raf = requestAnimationFrame(frame);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return <canvas ref={canvasRef} className="menu-canvas" aria-hidden="true" />;
}
