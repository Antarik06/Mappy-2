export default function AttackCard({ selectedNode, enemyNode, onPlanAttack, onAirstrike }) {
    if (!selectedNode || !enemyNode) return null;
    return (
        <div style={{ background: "var(--ui-panel)", border: "1px solid color-mix(in srgb, var(--ui-danger) 45%, transparent)", borderRadius: 8, padding: "16px 20px", minWidth: 260, backdropFilter: "blur(12px)", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
            <div style={{ fontSize: 10, color: "var(--ui-danger)", letterSpacing: "0.18em", fontWeight: 900, marginBottom: 6 }}>TARGET ACQUIRED</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 850, color: "var(--ui-text)" }}>{enemyNode.name.toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: "var(--ui-muted)" }}>ENEMY TROOPS: {Math.floor(enemyNode.troops)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 850, color: "var(--ui-accent)" }}>{selectedNode.name.toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: "var(--ui-muted)" }}>YOURS: {Math.floor(selectedNode.troops)}</div>
                </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onPlanAttack} style={{ flex: 1, background: "color-mix(in srgb, var(--ui-danger) 16%, transparent)", border: "1px solid color-mix(in srgb, var(--ui-danger) 42%, transparent)", borderRadius: 6, padding: "10px", fontSize: 10, color: "var(--ui-danger)", cursor: "pointer", letterSpacing: "0.08em", fontWeight: 900, fontFamily: "inherit" }}>
                    PLAN ATTACK
                </button>
                {selectedNode.isAirbase && (
                    <button onClick={onAirstrike} style={{ flex: 1, background: "color-mix(in srgb, var(--ui-accent) 16%, transparent)", border: "1px solid color-mix(in srgb, var(--ui-accent) 42%, transparent)", borderRadius: 6, padding: "10px", fontSize: 10, color: "var(--ui-accent)", cursor: "pointer", letterSpacing: "0.08em", fontWeight: 900, fontFamily: "inherit" }}>
                        AIRSTRIKE
                    </button>
                )}
            </div>
        </div>
    );
}
