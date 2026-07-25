/**
 * Shared shell for every floating panel on the map.
 *
 * The header is always visible and always clickable to collapse/expand —
 * callers put whatever compact "peek" summary belongs there (a value, a
 * name, a dot). Collapsing hides everything else, shrinking the card to a
 * single-row pill, so nothing has to sit on screen as a permanent sidebar.
 */
export default function FloatingCard({ className = "", collapsed, onToggleCollapse, header, children, onClose }) {
    return (
        <div className={`panel floating-card${collapsed ? " is-collapsed" : ""} ${className}`.trim()}>
            <div className="card-header-row">
                <button
                    className="card-header-hit"
                    type="button"
                    onClick={onToggleCollapse}
                    aria-expanded={!collapsed}
                >
                    {header}
                </button>
                <div className="card-header-actions">
                    <button
                        className="icon-btn icon-btn-sm"
                        type="button"
                        onClick={onToggleCollapse}
                        title={collapsed ? "Expand" : "Collapse"}
                    >
                        {collapsed ? "▸" : "▾"}
                    </button>
                    {onClose && (
                        <button className="icon-btn icon-btn-sm" type="button" onClick={onClose} title="Close">
                            ✕
                        </button>
                    )}
                </div>
            </div>
            {/* Three layers on purpose: the wrap is the 1fr/0fr accordion track,
                the clip is a bare box that can actually shrink to zero, and the
                inner one carries all the padding. Spacing on the grid item
                itself would hold the track open and defeat the collapse. */}
            <div className="card-body-wrap">
                <div className="card-body-clip">
                    <div className="card-body-inner">{children}</div>
                </div>
            </div>
        </div>
    );
}
