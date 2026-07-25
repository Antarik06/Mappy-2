// ============================================================
// Territory names. Assembled from parts so a 34-territory map never
// repeats and every seed reads like a different country.
// ============================================================

const PREFIX = [
    "Ash", "Black", "Bright", "Cold", "Dun", "Ember", "Fair", "Grey", "Hollow",
    "Iron", "Kest", "Long", "Mor", "North", "Oak", "Pale", "Quill", "Raven",
    "Salt", "Storm", "Thorn", "Vale", "West", "Wolf", "Wyn", "Amber", "Bram",
    "Crow", "Deep", "Elder", "Frost", "Gale", "Hearth", "Loch", "Myr", "Red",
];

const SUFFIX = [
    "hold", "march", "reach", "fell", "moor", "watch", "gate", "crag", "mere",
    "ford", "barrow", "vale", "hallow", "spire", "wick", "stead", "burn", "hurst",
];

const STANDALONE = [
    "The Rookery", "Sunken Mile", "Nine Cairns", "Old Kingsway", "The Drowned Step",
    "Widow's Gap", "Last Lantern", "The Cinderfields", "Sorrow's End", "Kettleflats",
];

/** Capitals get a grander name than the territories around them. */
const CAPITAL_TITLES = ["Keep", "Citadel", "Bastion", "Seat", "Throne", "Crown"];

export function makeNamePool(rng, count) {
    const pool = new Set();
    // A couple of hand-written oddities keep the map from feeling generated.
    const flavourCount = Math.min(2, Math.floor(count / 12));
    rng.shuffle(STANDALONE).slice(0, flavourCount).forEach((n) => pool.add(n));

    let guard = 0;
    while (pool.size < count && guard++ < count * 60) {
        pool.add(rng.pick(PREFIX) + rng.pick(SUFFIX));
    }
    // Fallback in the vanishingly unlikely case the pool starves.
    let i = 1;
    while (pool.size < count) pool.add(`Outpost ${i++}`);

    return rng.shuffle([...pool]).slice(0, count);
}

export function capitalName(rng, factionName) {
    return `${factionName} ${rng.pick(CAPITAL_TITLES)}`;
}
