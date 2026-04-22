// ============================================================
// DIJKSTRA shortest path
// ============================================================
export function dijkstra(nodes, edges, srcId, tgtId) {
    const nodeMap = {};
    nodes.forEach(n => nodeMap[n.id] = n);

    const adj = {};
    nodes.forEach(n => adj[n.id] = []);
    edges.forEach(e => {
        adj[e.n1].push({ to: e.n2, w: e.weight, edge: e });
        adj[e.n2].push({ to: e.n1, w: e.weight, edge: e });
    });

    const dist = {};
    const prev = {};
    const pq = []; // [dist, nodeId]
    nodes.forEach(n => { dist[n.id] = Infinity; prev[n.id] = null; });
    dist[srcId] = 0;
    pq.push([0, srcId]);

    while (pq.length > 0) {
        pq.sort((a, b) => a[0] - b[0]);
        const [d, u] = pq.shift();
        if (d > dist[u]) continue;
        if (u === tgtId) break;
        for (const { to, w } of (adj[u] || [])) {
            const nd = dist[u] + w;
            if (nd < dist[to]) {
                dist[to] = nd;
                prev[to] = u;
                pq.push([nd, to]);
            }
        }
    }

    if (dist[tgtId] === Infinity) return null;
    const path = [];
    let cur = tgtId;
    while (cur) { path.unshift(cur); cur = prev[cur]; }
    return { path, cost: dist[tgtId] };
}

// Find k alternative paths (Yen's k-shortest simplified)
export function findKPaths(nodes, edges, srcId, tgtId, k = 4) {
    const result = [];
    const base = dijkstra(nodes, edges, srcId, tgtId);
    if (!base) return [];
    result.push(base);

    const seen = new Set([base.path.join(",")]);

    for (let iter = 0; iter < k - 1 && result.length < k; iter++) {
        const refPath = result[result.length > 0 ? result.length - 1 : 0].path;
        for (let i = 0; i < refPath.length - 1; i++) {
            const u = refPath[i], v = refPath[i + 1];
            const filteredEdges = edges.filter(e => !((e.n1 === u && e.n2 === v) || (e.n1 === v && e.n2 === u)));
            const alt = dijkstra(nodes, filteredEdges, srcId, tgtId);
            if (alt && !seen.has(alt.path.join(","))) {
                seen.add(alt.path.join(","));
                result.push(alt);
            }
        }
    }
    return result.sort((a, b) => a.cost - b.cost);
}
