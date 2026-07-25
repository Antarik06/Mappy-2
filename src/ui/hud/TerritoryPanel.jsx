import { COMMAND } from "../../engine/config";
import { faction as factionOf } from "../../engine/config";
import { terrainOf } from "../../engine/terrain";
import FloatingCard from "./FloatingCard";

function Stat({ label, value, tone }) {
    return (
        <div className="stat">
            <span className="stat-label">{label}</span>
            <span className={`stat-value numeric${tone ? ` ${tone}` : ""}`}>{value}</span>
        </div>
    );
}

const BUILDS = [
    { key: "fortify", name: "Fortify", note: "+32% defence per level", action: "onFortify" },
    { key: "barracks", name: "Barracks", note: "+40% recruitment, +15 cap", action: "onBarracks" },
    { key: "watchtower", name: "Watchtower", note: "See two steps into the fog", action: "onWatchtower" },
    { key: "rally", name: "Raise levy", note: `Instant +${COMMAND.rallyTroops} troops`, action: "onRally" },
];

// Nothing selected — no reason to occupy a corner of the screen with an
// empty placeholder. The card only exists once there is something to show.
export default function TerritoryPanel({ report, command, handlers, collapsed, onToggleCollapse, onClose }) {
    if (!report) return null;

    const t = report.territory;
    const terrain = terrainOf(t.terrain);
    const f = factionOf(t.owner);
    const mine = t.owner === "player";
    const unknown = !t.visible && t.intelAt < 0;
    const garrison = unknown ? "?" : Math.round(t.visible ? t.troops : t.intel);

    const canBuild = {
        fortify: mine && t.fort < COMMAND.maxFortLevel,
        barracks: mine && !t.barracks,
        watchtower: mine && !t.watchtower,
        rally: mine && t.supplied,
    };

    return (
        <FloatingCard
            className="territory-panel"
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            onClose={onClose}
            header={
                <span className="card-peek tp-peek">
                    <span className="standing-dot" style={{ background: f.color }} />
                    <span className="tp-peek-name">{t.name}</span>
                    <span className="tp-peek-troops numeric">{garrison}</span>
                </span>
            }
        >
            <div className="tp-head">
                <span className="tp-owner" style={{ color: f.color }}>
                    {mine ? "Your holding" : f.name}
                    {t.isCapital && " · Capital"}
                </span>
                <p className="tp-terrain">
                    <strong style={{ color: terrain.accent }}>{terrain.label}</strong> — {terrain.trait}
                </p>
            </div>

            <div className="tp-stats">
                <Stat label="Garrison" value={garrison} />
                <Stat label="Ceiling" value={report.capacity} />
                <Stat label="Defence" value={`×${report.defense.toFixed(2)}`} tone="good" />
                <Stat
                    label="Incoming"
                    value={report.threat > 0 ? `−${Math.round(report.threat)}` : "—"}
                    tone={report.threat > 0 ? "warn" : undefined}
                />
            </div>

            {!t.visible && t.intelAt >= 0 && (
                <div className="tp-flag info">
                    <span>◐</span>
                    <span>Stale intel — this is what your scouts last saw, not what is there now.</span>
                </div>
            )}

            {t.owner !== "neutral" && !t.supplied && (
                <div className="tp-flag danger">
                    <span>⛓</span>
                    <span>
                        <strong>Cut off.</strong> No growth, and the garrison is bleeding out.
                    </span>
                </div>
            )}

            {report.threat > 0 && (
                <div className="tp-flag warn">
                    <span>⚔</span>
                    <span>{Math.round(report.threat)} hostile troops are marching on this holding.</span>
                </div>
            )}

            {t.isChokepoint && (
                <div className="tp-flag info">
                    <span>⛰</span>
                    <span>Chokepoint — most routes across the map pass through here.</span>
                </div>
            )}

            {!mine && t.owner !== "neutral" && report.severs > 0 && (
                <div className="tp-flag warn">
                    <span>✂</span>
                    <span>
                        Taking this would sever <strong>{report.severs}</strong> of their holdings from their capital.
                    </span>
                </div>
            )}

            {mine && (
                <div className="build-grid">
                    <span className="eyebrow">Command · {Math.floor(command)} available</span>
                    {BUILDS.map((b) => {
                        const cost = COMMAND.costs[b.key];
                        const affordable = command >= cost;
                        return (
                            <button
                                key={b.key}
                                className="build"
                                type="button"
                                disabled={!canBuild[b.key] || !affordable}
                                onClick={() => handlers[b.action]?.(t.index)}
                                title={!canBuild[b.key] ? "Already built here" : !affordable ? "Not enough command" : undefined}
                            >
                                <span>
                                    <span className="build-name">
                                        {b.name}
                                        {b.key === "fortify" && t.fort > 0 && ` · level ${t.fort}`}
                                    </span>
                                    <span className="build-note">{b.note}</span>
                                </span>
                                <span className="build-cost numeric">{cost}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </FloatingCard>
    );
}
