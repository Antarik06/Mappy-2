// ============================================================
// CONSTANTS & CONFIG
// ============================================================
export const OWNER_COLORS = {
    player: "#d7ff3f",
    ai1: "#ff3d2e",
    ai2: "#7c3cff",
    ai3: "#ffb000",
    neutral: "#667085",
};

export const OWNER_GLOW = {
    player: "rgba(215,255,63,0.62)",
    ai1: "rgba(255,61,46,0.58)",
    ai2: "rgba(124,60,255,0.58)",
    ai3: "rgba(255,176,0,0.56)",
    neutral: "rgba(102,112,133,0.32)",
};

export const THEMES = {
    dark: {
        canvasBg: "#07070a",
        grid: "rgba(255,255,255,0.026)",
        panel: "rgba(10,10,14,0.86)",
        panelBorder: "rgba(255,255,255,0.1)",
        text: "rgba(245,246,238,0.86)",
        muted: "rgba(245,246,238,0.46)",
        road: "#3f4656",
        innerNode: "rgba(7,7,10,0.78)",
        accent: "#d7ff3f",
        danger: "#ff3d2e",
        route: "#d7ff3f",
    },
    light: {
        canvasBg: "#f5f2e8",
        grid: "rgba(19,26,36,0.055)",
        panel: "rgba(255,252,242,0.88)",
        panelBorder: "rgba(20,25,34,0.14)",
        text: "rgba(18,22,28,0.86)",
        muted: "rgba(18,22,28,0.48)",
        road: "#a9a49a",
        innerNode: "rgba(255,252,242,0.82)",
        accent: "#6e8f00",
        danger: "#c42e1f",
        route: "#91b400",
    },
};

export function getTheme(themeName = "dark") {
    return THEMES[themeName] || THEMES.dark;
}

export const NODE_NAMES = [
    "Axiom", "Bastion", "Cipher", "Dusk", "Echo", "Forge", "Ghost", "Hydra",
    "Iron", "Jade", "Krypt", "Lunar", "Mire", "Nova", "Onyx", "Prism", "Quasar",
    "Rift", "Storm", "Titan", "Umbra", "Veil", "Warp", "Xenon", "Yolk", "Zeno",
    "Apex", "Blight", "Crux", "Delta", "Embers", "Flux", "Gloom", "Haven",
    "Inertia", "Jolt", "Knell", "Lumen", "Murk", "Nexus", "Orbit",
];

export const TROOP_REGEN_RATE = 1.2;
export const AI_TICK = 2500;
export const EVENT_INTERVAL = 18000;
export const SWARM_SPEED_BASE = 55;
export const JET_SPEED = 180;
