import { faction as factionOf, GAME } from "../../engine/config";

/**
 * Floating chrome rather than a bar: three separate clusters sitting on a
 * gradient scrim, so the map reads as one continuous surface underneath.
 */
export default function TopBar({
    standings,
    seed,
    paused,
    soundOn,
    unread,
    feedOpen,
    onTogglePause,
    onToggleSound,
    onToggleFeed,
    onHelp,
    onQuit,
}) {
    return (
        <div className="topbar">
            <div className="topbar-scrim" aria-hidden="true" />

            <div className="cluster brand">
                <span className="brand-name">{GAME.name}</span>
                <span className="brand-seed numeric">{seed}</span>
            </div>

            <div className="standings">
                {standings.map((s) => {
                    const f = factionOf(s.id);
                    return (
                        <div
                            key={s.id}
                            className={`cluster standing${f.isPlayer ? " is-you" : ""}${s.alive ? "" : " is-dead"}`}
                            title={`${f.name} — ${s.territories} territories, ${s.troops} troops`}
                        >
                            <span className="standing-dot" style={{ background: f.color }} />
                            <span className="standing-name">{f.isPlayer ? "YOU" : f.name.toUpperCase()}</span>
                            <span className="standing-figures numeric">
                                {s.territories}<span className="unit">t</span> · {s.troops}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="cluster topbar-tools">
                <button
                    className="icon-btn has-badge"
                    type="button"
                    aria-pressed={feedOpen}
                    onClick={onToggleFeed}
                    title="Dispatches"
                >
                    <span aria-hidden="true">✉</span>
                    {unread > 0 && !feedOpen && (
                        <span className="badge numeric">{unread > 9 ? "9+" : unread}</span>
                    )}
                    <span className="sr-only">
                        Dispatches{unread > 0 ? `, ${unread} unread` : ""}
                    </span>
                </button>
                <button
                    className="icon-btn"
                    type="button"
                    aria-pressed={paused}
                    onClick={onTogglePause}
                    title={paused ? "Resume (Space)" : "Pause (Space)"}
                >
                    {paused ? "▶" : "❚❚"}
                </button>
                <button
                    className="icon-btn"
                    type="button"
                    aria-pressed={soundOn}
                    onClick={onToggleSound}
                    title={soundOn ? "Mute" : "Unmute"}
                >
                    {soundOn ? "♪" : "✕"}
                </button>
                <button className="icon-btn" type="button" onClick={onHelp} title="How to play (?)">?</button>
                <button className="icon-btn" type="button" onClick={onQuit} title="Abandon the campaign">⏻</button>
            </div>
        </div>
    );
}
