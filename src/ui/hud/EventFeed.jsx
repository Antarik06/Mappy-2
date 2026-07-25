import FloatingCard from "./FloatingCard";

/**
 * Dispatches. Hidden until the player opens it from the top bar, then
 * collapsible in place like every other card on the map.
 */
export default function EventFeed({ entries, open, collapsed, onToggleCollapse, onClose }) {
    if (!open) return null;

    return (
        <FloatingCard
            className="feed"
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            onClose={onClose}
            header={
                <span className="card-peek">
                    <span className="eyebrow">Dispatches</span>
                    {entries.length > 0 && (
                        <span className="tp-peek-troops numeric">{entries.length}</span>
                    )}
                </span>
            }
        >
            <div className="feed-list" aria-live="polite">
                {entries.length === 0 && (
                    <p className="feed-empty">Nothing to report yet.</p>
                )}
                {entries.map((entry) => (
                    <div className={`feed-item ${entry.tone}`} key={entry.id}>
                        <div className="feed-title">
                            {entry.icon ? `${entry.icon} ` : ""}{entry.title}
                        </div>
                        {entry.body && <div className="feed-body">{entry.body}</div>}
                    </div>
                ))}
            </div>
        </FloatingCard>
    );
}

export function WorldEventBanner({ event }) {
    if (!event) return null;
    return (
        <div className="event-banner">
            <span className="event-icon" aria-hidden="true">{event.icon}</span>
            <div>
                <div className="event-label">{event.label}</div>
                <div className="event-blurb">{event.blurb}</div>
            </div>
            <span className="event-timer numeric">{Math.ceil(event.remaining)}s</span>
        </div>
    );
}
