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
    const [ui, setUI] = useState({ phase: "menu" }); // menu | playing | gameover

    // ---- INIT ----
    const initGame = useCallback(() => {
        const W = window.innerWidth, H = window.innerHeight;
        const { nodes, edges } = generateGraph(22, Math.min(W, 1100) - 40, Math.min(H, 800) - 40);

        // Assign starting owners
        const shuffled = [...nodes].sort(() => Math.random() - 0.5);
        shuffled[0].owner = "player"; shuffled[0].troops = 50;
        shuffled[1].owner = "ai1"; shuffled[1].troops = 40;
        shuffled[2].owner = "ai2"; shuffled[2].troops = 40;
        shuffled[3].owner = "ai3"; shuffled[3].troops = 40;

        stateRef.current = {
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
        };
        setUI({ phase: "playing" });
    }, []);

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

            update(gs, dt, ts, setUI);
            draw(ctx, canvas, gs, ts);

            animRef.current = requestAnimationFrame(loop);
        };

        animRef.current = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener("resize", resize);
            lastTimeRef.current = null;
        };
    }, [ui.phase]);

    // ---- INPUT HANDLERS ----
    const handlePointerDown = useCallback((e) => {
        e.preventDefault();
        const gs = stateRef.current;
        if (!gs || gs.gameOver) return;
        const pos = e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
        processPointerDown(gs, canvasRef.current, pos);
    }, []);

    const handlePointerMove = useCallback((e) => {
        e.preventDefault();
        const gs = stateRef.current;
        if (!gs || gs.gameOver) return;
        const pos = e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
        processPointerMove(gs, canvasRef.current, pos);
    }, []);

    const handlePointerUp = useCallback((e) => {
        const gs = stateRef.current;
        if (!gs || gs.gameOver) return;
        const pos = e.changedTouches ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } : { x: e.clientX, y: e.clientY };
        processPointerUp(gs, canvasRef.current, pos);
    }, []);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const gs = stateRef.current;
        if (!gs) return;
        processWheel(gs, canvasRef.current, e.deltaY, e.clientX, e.clientY);
    }, []);

    // ---- ACTION HANDLERS ----
    const handleStartRouteSelect = () => startRouteSelect(stateRef.current);
    const handleUpgradeAirbase = () => upgradeAirbase(stateRef.current);
    const handleLaunchAirstrike = () => launchAirstrike(stateRef.current);

    // ---- RENDER ----
    const gs = stateRef.current;
    const selectedNode = gs?.nodes?.find(n => n.id === gs.selectedNodeId) || null;
    const enemyNode = gs?.nodes?.find(n => n.id === gs.selectedEnemyId) || null;

    return (
        <div style={{ width: "100vw", height: "100vh", background: "#080b14", overflow: "hidden", fontFamily: "'Courier New', monospace", position: "relative" }}>
            {/* CANVAS */}
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

            {/* MENU */}
            {ui.phase === "menu" && (
                <MenuScreen onStart={initGame} />
            )}

            {/* GAME OVER */}
            {ui.phase === "gameover" && (
                <GameOverScreen
                    won={ui.won}
                    onRestart={() => { stateRef.current = null; setUI({ phase: "menu" }); }}
                />
            )}

            {/* HUD OVERLAY — during play */}
            {ui.phase === "playing" && gs && (
                <HUDOverlay
                    gs={gs}
                    selectedNode={selectedNode}
                    enemyNode={enemyNode}
                    onPlanAttack={handleStartRouteSelect}
                    onAirstrike={handleLaunchAirstrike}
                    onUpgradeAirbase={handleUpgradeAirbase}
                />
            )}

            <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; }
      `}</style>
        </div>
    );
}
