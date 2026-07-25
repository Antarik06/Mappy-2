// ============================================================
// World events. Periodic, map-wide, and always visible in advance of
// resolving so they shift plans rather than punish at random.
// ============================================================

import { EVENTS } from "./config";
import { pushLog, spawnEffect } from "./state";

const CATALOGUE = [
    {
        id: "winter",
        label: "Hard Winter",
        blurb: "Growth halves and every column slows to a trudge.",
        icon: "❄",
        regenScale: 0.5,
        speedScale: 0.78,
    },
    {
        id: "forcedMarch",
        label: "Forced March",
        blurb: "Roads run dry and hard — armies move 60% faster.",
        icon: "⇶",
        speedScale: 1.6,
    },
    {
        id: "tithe",
        label: "Harvest Tithe",
        blurb: "Command income nearly doubles while the granaries are full.",
        icon: "◈",
        commandScale: 1.85,
    },
    {
        id: "rains",
        label: "Season of Rains",
        blurb: "Fields flourish, roads turn to mud.",
        icon: "≈",
        regenScale: 1.35,
        speedScale: 0.72,
    },
    {
        id: "fogbank",
        label: "Fog Bank",
        blurb: "Scouts are blind — you only see your own garrisons.",
        icon: "☁",
        blindsScouts: true,
    },
    {
        id: "levy",
        label: "General Levy",
        blurb: "Every supplied holding raises fresh troops.",
        icon: "⚔",
        instant: true,
        apply(state) {
            for (const t of state.territories) {
                if (t.owner !== "neutral" && t.supplied) t.troops += 5;
            }
        },
    },
    {
        id: "uprising",
        label: "Peasant Uprising",
        blurb: "Thinly-held ground throws off its banners.",
        icon: "✷",
        instant: true,
        apply(state) {
            // Only weakly-garrisoned, non-capital ground revolts, so this
            // punishes overextension rather than striking at random.
            const candidates = state.territories
                .filter((t) => t.owner !== "neutral" && !t.isCapital && t.troops < 9)
                .sort((a, b) => a.troops - b.troops)
                .slice(0, 3);
            for (const t of candidates) {
                t.owner = "neutral";
                t.troops = Math.max(6, Math.round(t.troops + 4));
                t.fort = Math.max(0, t.fort - 1);
                t.barracks = false;
                spawnEffect(state, { kind: "revolt", at: t.centroid, life: 1.4 });
            }
            return candidates.length;
        },
    },
];

export function updateEvents(state, dt) {
    if (state.activeEvent) {
        state.activeEvent.remaining -= dt;
        if (state.activeEvent.remaining <= 0) {
            pushLog(state, { title: `${state.activeEvent.label} passes`, tone: "neutral" });
            state.activeEvent = null;
        }
    }

    state.nextEventAt -= dt;
    if (state.nextEventAt > 0) return;

    const template = state.rng.pick(CATALOGUE);
    state.nextEventAt = state.rng.range(EVENTS.interval[0], EVENTS.interval[1]);

    if (template.instant) {
        const count = template.apply(state);
        if (count === 0) return;    // nothing happened — don't announce it
        pushLog(state, { title: template.label, body: template.blurb, tone: "event", icon: template.icon });
        state.lastFlash = { ...template, at: state.time };
        return;
    }

    state.activeEvent = { ...template, remaining: EVENTS.duration, startedAt: state.time };
    state.lastFlash = { ...template, at: state.time };
    pushLog(state, { title: template.label, body: template.blurb, tone: "event", icon: template.icon });
}
