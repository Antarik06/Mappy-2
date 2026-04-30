import { useState, useEffect, useRef, useCallback } from "react";

// Game logic
import { generateGraph } from '../game/graphGeneration';
import { update } from '../game/update';
import { draw } from '../game/renderer';
import { processPointerDown, processPointerMove, processPointerUp, processWheel } from '../game/input';
import { startRouteSelect, upgradeAirbase, launchAirstrike } from '../game/actions';

// UI Components
import MenuScreen from './MenuScreen';
import GameOverScreen from './GameOverScreen';
import GameCanvas from './GameCanvas';
import HUDOverlay from './hud/HUDOverlay';

export default function MappyGame() {
    const canvasRef = useRef(null);
    const stateRef = useRef(null);
    const animRef = useRef(null);
    const lastTimeRef = useRef(null);
    const hudRefreshRef = useRef(0);
    const [theme, setTheme] = useState("dark");
    const [ui, setUI] = useState({ phase: "menu" }); // menu | playing | gameover
    const [gameSnapshot, setGameSnapshot] = useState(null);

    const publishGameSnapshot = useCallback(() => {
        const gs = stateRef.current;
        setGameSnapshot(gs ? { ...gs } : null);
    }, []);

    // ---- INIT ----
    const initGame = useCallback(() => {
        const W = window.innerWidth, H = window.innerHeight;
        const { nodes, edges } = generateGraph(30, Math.min(W, 1100) - 40, Math.min(H, 800) - 40);

        // Assign starting owners
        const shuffled = [...nodes].sort(() => Math.random() - 0.5);
        shuffled[0].owner = "player"; shuffled[0].troops = 50;
        shuffled[1].owner = "ai1"; shuffled[1].troops = 40;
        shuffled[2].owner = "ai2"; shuffled[2].troops = 40;
        shuffled[3].owner = "ai3"; shuffled[3].troops = 40;

        const nextGameState = {
            nodes, edges,
            swarms: [],
            jets: [],
            particles: [],
            events: [],
            selectedNodeId: null,
            selectedEnemyId: null,
            mode: "normal", // normal | route-select | drag
            attackRoutes: [],
            hoveredRouteIdx: 0,
            dragPos: null,
            currentDragPath: null,
            dragTargetId: null,
            aiTick: 0,
            eventTick: 0,
            playerOwner: "player",
            gameOver: false,
            winner: null,
            panX: 0, panY: 0, zoom: 1,
            pointerDown: false,
            pointerDownPos: { x: 0, y: 0 },
            lastPointerPos: { x: 0, y: 0 },
            isPanning: false,
            isDragging: false,
            potentialDragId: null,
            paused: false,
            pauseTs: null,
            pauseWallAt: null,
            theme,
        };
        stateRef.current = nextGameState;
        setGameSnapshot({ ...nextGameState });
        setUI({ phase: "playing" });
    }, [theme]);

    // ---- GAME LOOP ----
    useEffect(() => {
        if (ui.phase !== "playing") return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener("resize", resize);

        const loop = (ts) => {
            if (!lastTimeRef.current) lastTimeRef.current = ts;
            const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.1);
            lastTimeRef.current = ts;

            const gs = stateRef.current;
            if (!gs || gs.gameOver) { animRef.current = requestAnimationFrame(loop); return; }

            gs.theme = theme;
            if (gs.paused) {
                draw(ctx, canvas, gs, gs.pauseTs ?? ts);
            } else {
                update(gs, dt, ts, setUI);
                draw(ctx, canvas, gs, ts);
            }
            hudRefreshRef.current += dt;
            if (hudRefreshRef.current >= 0.25) {
                hudRefreshRef.current = 0;
                publishGameSnapshot();
            }

            animRef.current = requestAnimationFrame(loop);
        };

        animRef.current = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener("resize", resize);
            lastTimeRef.current = null;
            hudRefreshRef.current = 0;
        };
    }, [publishGameSnapshot, theme, ui.phase]);

    // ---- INPUT HANDLERS ----
    const handlePointerDown = useCallback((e) => {
        e.preventDefault();
        const gs = stateRef.current;
        if (!gs || gs.gameOver || gs.paused) return;
        const pos = e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
        processPointerDown(gs, canvasRef.current, pos);
        publishGameSnapshot();
    }, [publishGameSnapshot]);

    const handlePointerMove = useCallback((e) => {
        e.preventDefault();
        const gs = stateRef.current;
        if (!gs || gs.gameOver || gs.paused) return;
        const pos = e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
        processPointerMove(gs, canvasRef.current, pos);
        if (gs.isDragging || gs.mode === "route-select") publishGameSnapshot();
    }, [publishGameSnapshot]);

    const handlePointerUp = useCallback((e) => {
        const gs = stateRef.current;
        if (!gs || gs.gameOver || gs.paused) return;
        const pos = e.changedTouches ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } : { x: e.clientX, y: e.clientY };
        processPointerUp(gs, canvasRef.current, pos, e.ctrlKey);
        publishGameSnapshot();
    }, [publishGameSnapshot]);

    const handleWheel = useCallback((e) => {
        const gs = stateRef.current;
        if (!gs || gs.paused) return;
        processWheel(gs, canvasRef.current, e.deltaY, e.clientX, e.clientY);
        publishGameSnapshot();
    }, [publishGameSnapshot]);

    // ---- ACTION HANDLERS ----
    const handleStartRouteSelect = () => {
        if (stateRef.current?.paused) return;
        startRouteSelect(stateRef.current);
        publishGameSnapshot();
    };
    const handleUpgradeAirbase = () => {
        if (stateRef.current?.paused) return;
        upgradeAirbase(stateRef.current);
        publishGameSnapshot();
    };
    const handleLaunchAirstrike = () => {
        if (stateRef.current?.paused) return;
        launchAirstrike(stateRef.current);
        publishGameSnapshot();
    };
    const handleTogglePause = () => {
        const gs = stateRef.current;
        if (!gs || gs.gameOver) return;
        if (gs.paused) {
            const pausedFor = Date.now() - (gs.pauseWallAt ?? Date.now());
            gs.events.forEach(event => {
                event.expiresAt += pausedFor;
            });
            gs.paused = false;
            gs.pauseTs = null;
            gs.pauseWallAt = null;
        } else {
            gs.paused = true;
            gs.pauseTs = performance.now();
            gs.pauseWallAt = Date.now();
        }
        lastTimeRef.current = null;
        publishGameSnapshot();
    };
    const handleToggleTheme = () => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        if (stateRef.current) {
            stateRef.current.theme = nextTheme;
            publishGameSnapshot();
        }
    };

    // ---- RENDER ----
    const gs = gameSnapshot;
    const selectedNode = gs?.nodes?.find(n => n.id === gs.selectedNodeId) || null;
    const enemyNode = gs?.nodes?.find(n => n.id === gs.selectedEnemyId) || null;

    return (
        <div className={`app-shell theme-${theme}`} style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>

            {ui.phase === "playing" && (
                <GameCanvas
                    ref={canvasRef}
                    isDragging={gs?.isDragging}
                    onMouseDown={handlePointerDown}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onWheel={handleWheel}
                    onTouchStart={handlePointerDown}
                    onTouchMove={handlePointerMove}
                    onTouchEnd={handlePointerUp}
                />
            )}


            {ui.phase === "menu" && (
                <MenuScreen onStart={initGame} theme={theme} onToggleTheme={handleToggleTheme} />
            )}


            {ui.phase === "gameover" && (
                <GameOverScreen
                    won={ui.won}
                    onRestart={() => { stateRef.current = null; setGameSnapshot(null); setUI({ phase: "menu" }); }}
                />
            )}


            {ui.phase === "playing" && gs && (
                <HUDOverlay
                    gs={gs}
                    selectedNode={selectedNode}
                    enemyNode={enemyNode}
                    onPlanAttack={handleStartRouteSelect}
                    onAirstrike={handleLaunchAirstrike}
                    onUpgradeAirbase={handleUpgradeAirbase}
                    onTogglePause={handleTogglePause}
                    onToggleTheme={handleToggleTheme}
                    theme={theme}
                />
            )}

            <style>
                {`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} } * { box-sizing: border-box; }`}
            </style>
        </div>
    );
}
