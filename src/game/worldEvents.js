// ============================================================
// WORLD EVENTS
// ============================================================
export function pushEvent(gs, title, desc) {
    gs.events.unshift({ id: Math.random().toString(), title, desc, expiresAt: Date.now() + 5000 });
    if (gs.events.length > 5) gs.events.length = 5;
}

export function triggerWorldEvent(gs) {
    const nonNeutral = gs.nodes.filter(n => n.owner !== "neutral");
    if (!nonNeutral.length) return;
    const target = nonNeutral[Math.floor(Math.random() * nonNeutral.length)];
    const roll = Math.random();
    if (roll < 0.4) {
        target.troops = Math.floor(target.troops * 0.5);
        pushEvent(gs, "🌊 NATURAL DISASTER", `${target.name} lost half its forces to catastrophe!`);
    } else if (roll < 0.7) {
        const bonus = 15 + Math.floor(Math.random() * 20);
        target.troops = Math.min(target.maxTroops, target.troops + bonus);
        pushEvent(gs, "📦 SUPPLY DROP", `${target.name} received ${bonus} reinforcements!`);
    } else {
        target.owner = "neutral";
        target.troops = 12;
        pushEvent(gs, "💀 CIVIL REVOLT", `${target.name} has gone rogue — now neutral!`);
    }
}
