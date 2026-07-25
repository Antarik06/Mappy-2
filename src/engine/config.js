// ============================================================
// OPERATION ATLAS — balance configuration
// Every tunable number in the game lives here.
// ============================================================

export const GAME = {
    name: "OPERATION ATLAS",
    tagline: "Command the front. Redraw the map.",
};

// ---- World shape ---------------------------------------------------------
// The map is a filled rectangle, not an island: territories run right to the
// edge so the board always covers the screen with no dead space. Aspect is
// widescreen-ish so cover-fitting crops as little as possible.
export const WORLD = {
    width: 2600,
    height: 1400,
    territories: 38,
    relaxIterations: 3,     // Lloyd relaxation passes — evens out cell sizes
    edgeMargin: 70,         // keep sites off the very edge so border cells aren't slivers
    coastBand: 260,         // within this of an edge counts as coastline
    minSiteSpacing: 150,
};

// ---- Growth --------------------------------------------------------------
// Garrisons follow logistic growth: dT/dt = k * regen * (1 - T / cap)
// so weak territories recover fast and strong ones plateau.
export const GROWTH = {
    k: 2.1,
    minRegenTroops: 0,
    neutralRegen: 0,        // neutrals are static until someone takes them
    unsuppliedAttrition: 0.55,  // troops lost per second when cut off
    unsuppliedFloor: 1,
};

// ---- Combat --------------------------------------------------------------
export const COMBAT = {
    // Forts are the defender's answer to the action economy: a one-off spend
    // that keeps paying while you are busy somewhere else on the map.
    fortDefenseStep: 0.32,      // each fort level adds this much defense
    unsuppliedDefensePenalty: 0.82,
    ambushLoss: 0.12,           // forest defender bite, applied to attacker
    minCaptureSurvivors: 1,
    interceptRange: 26,         // world units — armies this close on a road clash
    // Freshly taken ground can't launch an attack for a moment. This is the
    // main brake on blitz-chaining across the map in one unbroken push, and
    // it gives the defender a window to counter-attack into a weak capture.
    disorderSeconds: 8,
};

// ---- March ---------------------------------------------------------------
export const MARCH = {
    baseSpeed: 118,             // world units per second on neutral terrain
    minSendFraction: 0.1,
    maxSendFraction: 1.0,
    defaultSendFraction: 0.5,
    garrisonKeep: 1,            // a territory can never be emptied below this
    // Troops lost per second on the road. Makes distance a real cost, so deep
    // strikes have to be worth it and nearby ground is naturally cheaper.
    attritionPerSecond: 0.45,
    minArrivals: 1,
};

// ---- Command economy -----------------------------------------------------
// One resource. Spent on territory upgrades and instant plays.
export const COMMAND = {
    startingPoints: 40,
    max: 250,
    costs: {
        fortify: 35,    // +1 fort level (defense)
        barracks: 55,   // +40% regen, +15 cap
        watchtower: 30, // reveals garrisons two steps out
        rally: 25,      // instant +14 troops
    },
    rallyTroops: 14,
    maxFortLevel: 3,
};

// ---- World events --------------------------------------------------------
export const EVENTS = {
    firstDelay: 50,
    interval: [42, 68],     // seconds between events
    duration: 26,
};

// ---- Victory -------------------------------------------------------------
export const VICTORY = {
    // Winning by holding this share of the map for `holdSeconds` straight
    dominationShare: 0.7,
    holdSeconds: 20,
};

// ---- Difficulty ----------------------------------------------------------
export const DIFFICULTIES = {
    // `aiTick` is seconds between orders *per rival*. With three rivals on the
    // map their combined order rate is already triple a human's, so these are
    // deliberately slower than they look.
    recruit: {
        id: "recruit",
        label: "Recruit",
        blurb: "Rivals expand slowly and rarely gang up on you.",
        aiTick: 3.4,
        aiAggression: 0.6,
        aiSkill: 0.5,
        aiRegenBonus: 0.85,
        playerRegenBonus: 1.15,
        aiCount: 2,
    },
    commander: {
        id: "commander",
        label: "Commander",
        blurb: "A fair fight. Rivals defend, counter-attack and punish gaps.",
        aiTick: 2.4,
        aiAggression: 0.82,
        aiSkill: 0.78,
        aiRegenBonus: 0.97,
        playerRegenBonus: 1.0,
        aiCount: 2,
    },
    warlord: {
        id: "warlord",
        label: "Warlord",
        blurb: "Three rivals. They read supply lines, mass armies and hunt your capital.",
        aiTick: 1.95,
        aiAggression: 0.95,
        aiSkill: 0.95,
        aiRegenBonus: 1.05,
        playerRegenBonus: 0.95,
        aiCount: 3,
    },
};

// ---- Factions ------------------------------------------------------------
// `player` is always index 0. Colors are chosen to stay distinguishable
// against the dark map and from each other for common color deficiencies.
export const FACTIONS = {
    player: {
        id: "player",
        name: "Ironhold",
        short: "IRN",
        color: "#4FD6C4",
        deep: "#0E4F4C",
        glow: "rgba(79,214,196,0.55)",
        isPlayer: true,
    },
    crimson: {
        id: "crimson",
        name: "Crimson Pact",
        short: "CRM",
        color: "#FF6B6B",
        deep: "#5A1620",
        glow: "rgba(255,107,107,0.5)",
        personality: { aggression: 1.2, greed: 0.85, caution: 0.7 },
    },
    amber: {
        id: "amber",
        name: "Amber Company",
        short: "AMB",
        color: "#F2B138",
        deep: "#5A3D0C",
        glow: "rgba(242,177,56,0.5)",
        personality: { aggression: 0.8, greed: 1.3, caution: 1.0 },
    },
    violet: {
        id: "violet",
        name: "Violet Choir",
        short: "VLT",
        color: "#B08CFF",
        deep: "#33215C",
        glow: "rgba(176,140,255,0.5)",
        personality: { aggression: 1.0, greed: 1.0, caution: 1.25 },
    },
    neutral: {
        id: "neutral",
        name: "Free Holds",
        short: "FRE",
        color: "#8B93A7",
        deep: "#252A36",
        glow: "rgba(139,147,167,0.25)",
    },
};

export const AI_FACTIONS = ["crimson", "amber", "violet"];

export function faction(id) {
    return FACTIONS[id] || FACTIONS.neutral;
}
