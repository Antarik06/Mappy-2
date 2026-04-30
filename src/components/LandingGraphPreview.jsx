import { useEffect, useRef } from 'react';

const OWNERS = {
    player: '#d7ff3f',
    enemy: '#ff3d2e',
    neutral: '#778195',
};

const SCENES = {
    dark: {
        bg0: '#07070a',
        bg1: '#141014',
        bg2: '#211019',
        edge: 'rgba(245,246,238,0.2)',
        core: '#07070a',
    },
    light: {
        bg0: '#fffaf0',
        bg1: '#f3ead7',
        bg2: '#eadcca',
        edge: 'rgba(32,36,46,0.22)',
        core: '#fffaf0',
    },
};

function makeGraph(width, height) {
    const nodeCount = 28;
    const padding = Math.max(56, Math.min(width, height) * 0.1);
    const nodes = [];

    for (let i = 0; i < nodeCount; i++) {
        let best = null;
        let bestDistance = -1;
        for (let attempt = 0; attempt < 80; attempt++) {
            const x = padding + Math.random() * Math.max(1, width - padding * 2);
            const y = padding + Math.random() * Math.max(1, height - padding * 2);
            const minDistance = nodes.reduce((acc, node) => Math.min(acc, Math.hypot(node.x - x, node.y - y)), Infinity);
            if (minDistance > bestDistance) {
                bestDistance = minDistance;
                best = { x, y };
            }
        }
        nodes.push({
            id: i,
            x: best.x,
            y: best.y,
            owner: i < 4 ? 'player' : i < 13 ? 'enemy' : 'neutral',
            pulse: Math.random() * Math.PI * 2,
        });
    }

    const edges = [];
    const seen = new Set();
    const addEdge = (a, b) => {
        const key = [a, b].sort((x, y) => x - y).join('-');
        if (a === b || seen.has(key)) return;
        seen.add(key);
        edges.push({ a, b });
    };

    nodes.forEach((node, index) => {
        const nearest = nodes
            .map((other, otherIndex) => ({ otherIndex, distance: Math.hypot(node.x - other.x, node.y - other.y) }))
            .filter(item => item.otherIndex !== index)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3);
        nearest.forEach(item => addEdge(index, item.otherIndex));
    });

    return { nodes, edges };
}

function getFrontiers(nodes, edges) {
    return edges
        .map(edge => {
            const a = nodes[edge.a];
            const b = nodes[edge.b];
            if (a.owner === 'player' && b.owner !== 'player') return { from: a, to: b };
            if (b.owner === 'player' && a.owner !== 'player') return { from: b, to: a };
            return null;
        })
        .filter(Boolean);
}

function makeSwarms(nodes, edges) {
    const playerNodes = nodes.filter(node => node.owner === 'player');
    const frontiers = getFrontiers(nodes, edges);
    const attacks = frontiers.length ? frontiers : playerNodes.map((from, index) => ({ from, to: nodes[(index + 8) % nodes.length] }));

    return Array.from({ length: 46 }, (_, index) => {
        const route = attacks[index % attacks.length];
        return {
            from: route.from,
            to: route.to,
            progress: Math.random(),
            speed: 0.08 + Math.random() * 0.08,
            offset: (Math.random() - 0.5) * 18,
            size: 2 + Math.random() * 2.4,
        };
    });
}

export default function LandingGraphPreview({ theme = 'dark' }) {
    const canvasRef = useRef(null);
    const sceneRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let frameId = 0;
        let lastTime = performance.now();

        const resize = () => {
            const ratio = window.devicePixelRatio || 1;
            const width = window.innerWidth;
            const height = window.innerHeight;
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            sceneRef.current = {
                ...makeGraph(width, height),
                swarms: [],
                width,
                height,
            };
            sceneRef.current.swarms = makeSwarms(sceneRef.current.nodes, sceneRef.current.edges);
        };

        const draw = (now) => {
            const dt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;
            const scene = sceneRef.current;
            if (!scene) return;

            ctx.clearRect(0, 0, scene.width, scene.height);
            const sceneTheme = SCENES[theme] || SCENES.dark;
            const background = ctx.createLinearGradient(0, 0, scene.width, scene.height);
            background.addColorStop(0, sceneTheme.bg0);
            background.addColorStop(0.5, sceneTheme.bg1);
            background.addColorStop(1, sceneTheme.bg2);
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, scene.width, scene.height);

            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = sceneTheme.edge;
            scene.edges.forEach(edge => {
                const a = scene.nodes[edge.a];
                const b = scene.nodes[edge.b];
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            });
            ctx.globalAlpha = 1;

            scene.swarms.forEach(swarm => {
                swarm.progress += swarm.speed * dt;
                if (swarm.progress >= 1) {
                    swarm.progress = 0;
                    swarm.to.owner = 'player';
                    const next = getFrontiers(scene.nodes, scene.edges);
                    if (next.length) {
                        const route = next[Math.floor(Math.random() * next.length)];
                        swarm.from = route.from;
                        swarm.to = route.to;
                    }
                }

                const dx = swarm.to.x - swarm.from.x;
                const dy = swarm.to.y - swarm.from.y;
                const length = Math.max(1, Math.hypot(dx, dy));
                const nx = -dy / length;
                const ny = dx / length;
                const x = swarm.from.x + dx * swarm.progress + nx * swarm.offset;
                const y = swarm.from.y + dy * swarm.progress + ny * swarm.offset;

                ctx.beginPath();
                ctx.arc(x, y, swarm.size, 0, Math.PI * 2);
                ctx.fillStyle = OWNERS.player;
                ctx.shadowColor = OWNERS.player;
                ctx.shadowBlur = 14;
                ctx.fill();
                ctx.shadowBlur = 0;
            });

            scene.nodes.forEach(node => {
                const color = OWNERS[node.owner];
                const radius = node.owner === 'player' ? 12 : 9;
                const pulse = Math.sin(now / 420 + node.pulse) * 2;
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + pulse, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = node.owner === 'player' ? 28 : 14;
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius * 0.42, 0, Math.PI * 2);
                ctx.fillStyle = sceneTheme.core;
                ctx.fill();
            });

            frameId = requestAnimationFrame(draw);
        };

        resize();
        window.addEventListener('resize', resize);
        frameId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', resize);
        };
    }, [theme]);

    return <canvas className="landing-preview-canvas" ref={canvasRef} aria-hidden="true" />;
}
