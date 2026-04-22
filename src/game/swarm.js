// ============================================================
// SWARM (animated dots travelling a path)
// ============================================================
export function createSwarm(srcNode, tgtId, owner, path, amount, nodes) {
    const dots = [];
    for (let i = 0; i < amount; i++) {
        dots.push({
            x: srcNode.cx + (Math.random() - 0.5) * 30,
            y: srcNode.cy + (Math.random() - 0.5) * 30,
            targetIdx: 1,
            ox: (Math.random() - 0.5) * 20,
            oy: (Math.random() - 0.5) * 20,
            seed: Math.random() * 100,
        });
    }
    return { id: Math.random().toString(36).slice(2), owner, source: srcNode.id, target: tgtId, path, dots, arrivedTotal: 0, totalSize: amount, isJet: false };
}

export function createJetStrike(srcId, tgtId, owner) {
    return { id: Math.random().toString(36).slice(2), srcId, tgtId, owner, progress: 0, state: "outward" };
}
