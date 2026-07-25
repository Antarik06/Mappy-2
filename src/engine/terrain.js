// ============================================================
// Terrain. Every type is meant to change a real decision:
// where you attack, where you hold, and where you invest.
// ============================================================

export const TERRAIN = {
    plains: {
        id: "plains",
        label: "Plains",
        // Breadbasket: your economy lives here, but it is the easiest ground to lose.
        regen: 1.25,
        capacity: 62,
        defense: 0.9,
        speed: 1.2,
        command: 0.05,
        trait: "Open ground — fast growth, fast to fall.",
        fill: "#6E7B3F",
        fillDeep: "#3E4A22",
        accent: "#A8B863",
    },
    forest: {
        id: "forest",
        label: "Woodland",
        // Attackers bleed on arrival — cheap defensive value without a fort.
        regen: 0.9,
        capacity: 52,
        defense: 1.2,
        speed: 0.9,
        command: 0.035,
        trait: "Ambush — attackers lose 12% on arrival.",
        fill: "#31543A",
        fillDeep: "#1A3020",
        accent: "#5E9367",
    },
    hills: {
        id: "hills",
        label: "Highlands",
        regen: 0.8,
        capacity: 55,
        defense: 1.45,
        speed: 0.82,
        command: 0.04,
        trait: "High ground — strong defense, slow approach.",
        fill: "#6B5334",
        fillDeep: "#3C2D1B",
        accent: "#A2814F",
    },
    mountain: {
        id: "mountain",
        label: "Mountain Pass",
        // The chokepoint. Brutal to take, brutal to feed.
        regen: 0.5,
        capacity: 44,
        defense: 1.9,
        speed: 0.62,
        command: 0.03,
        trait: "Chokepoint — brutal to storm, slow to reinforce.",
        fill: "#5A5E6B",
        fillDeep: "#31343E",
        accent: "#8F95A6",
    },
    marsh: {
        id: "marsh",
        label: "Fenlands",
        // Not tough, but it wrecks your tempo — armies crawl through.
        regen: 0.7,
        capacity: 48,
        defense: 1.15,
        speed: 0.58,
        command: 0.03,
        trait: "Bogged down — armies crawl through the fens.",
        fill: "#3A5450",
        fillDeep: "#1E3130",
        accent: "#639089",
    },
    coast: {
        id: "coast",
        label: "Harbour",
        // Best command income on the map — worth defending even when exposed.
        regen: 1.05,
        capacity: 58,
        defense: 0.95,
        speed: 1.05,
        command: 0.085,
        trait: "Harbour — the richest source of command.",
        fill: "#4A6B7B",
        fillDeep: "#26404C",
        accent: "#7FB3C4",
    },
};

export const TERRAIN_IDS = Object.keys(TERRAIN);

export function terrainOf(id) {
    return TERRAIN[id] || TERRAIN.plains;
}
