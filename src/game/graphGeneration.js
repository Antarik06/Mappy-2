import { NODE_NAMES } from './constants';

export function generateGraph(nodeCount = 30, w = 900, h = 700) {
    // Place nodes with some randomness + padding
    const padding = 80;
    const nodes = [];
    const attempts = 200;

    for (let i = 0; i < nodeCount; i++) {
        let best = null;
        let bestDist = -1;
        for (let a = 0; a < attempts; a++) {
            const cx = padding + Math.random() * (w - padding * 2);
            const cy = padding + Math.random() * (h - padding * 2);
            let minD = Infinity;
            for (const n of nodes) {
                const d = Math.hypot(cx - n.cx, cy - n.cy);
                if (d < minD) minD = d;
            }
            if (minD > bestDist) {
                bestDist = minD;
                best = { cx, cy };
            }
        }
        const maxT = 80 + Math.floor(Math.random() * 120);
        nodes.push({
            id: `n${i}`,
            name: NODE_NAMES[i % NODE_NAMES.length],
            cx: best.cx,
            cy: best.cy,
            owner: "neutral",
            troops: 8 + Math.floor(Math.random() * 22),
            maxTroops: maxT,
            isAirbase: false,
        });
    }

    // Build edges: delaunay-ish via closest-pair + ensure connectivity
    const edges = [];
    const edgeSet = new Set();

    const addEdge = (a, b) => {
        const key = [a, b].sort().join("-");
        if (edgeSet.has(key) || a === b) return;
        edgeSet.add(key);
        const na = nodes[a], nb = nodes[b];
        const dist = Math.hypot(na.cx - nb.cx, na.cy - nb.cy);
        const weight = Math.round(dist);
        edges.push({ id: key, n1: na.id, n2: nb.id, weight, ambushBy: null });
    };

    // Connect each node to its k nearest
    for (let i = 0; i < nodes.length; i++) {
        const dists = nodes
            .map((n, j) => ({ j, d: Math.hypot(nodes[i].cx - n.cx, nodes[i].cy - n.cy) }))
            .filter(x => x.j !== i)
            .sort((a, b) => a.d - b.d);
        const k = 2 + Math.floor(Math.random() * 2);
        for (let t = 0; t < Math.min(k, dists.length); t++) addEdge(i, dists[t].j);
    }

    // Ensure connectivity via BFS + bridge edges
    const adj = Array.from({ length: nodes.length }, () => []);
    edges.forEach(e => {
        const a = nodes.findIndex(n => n.id === e.n1);
        const b = nodes.findIndex(n => n.id === e.n2);
        adj[a].push(b); adj[b].push(a);
    });

    const visited = new Array(nodes.length).fill(false);
    const bfs = (start) => {
        const q = [start]; visited[start] = true;
        while (q.length) {
            const cur = q.shift();
            adj[cur].forEach(nb => { if (!visited[nb]) { visited[nb] = true; q.push(nb); } });
        }
    };
    bfs(0);

    for (let i = 0; i < nodes.length; i++) {
        if (!visited[i]) {
            // find closest visited
            let best = -1, bestD = Infinity;
            for (let j = 0; j < nodes.length; j++) {
                if (visited[j]) {
                    const d = Math.hypot(nodes[i].cx - nodes[j].cx, nodes[i].cy - nodes[j].cy);
                    if (d < bestD) { bestD = d; best = j; }
                }
            }
            if (best >= 0) addEdge(i, best);
            bfs(i);
        }
    }

    return { nodes, edges };
}
