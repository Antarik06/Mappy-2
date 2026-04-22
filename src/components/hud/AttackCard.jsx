export default function AttackCard({ selectedNode, enemyNode, onPlanAttack, onAirstrike }) {
    if (!selectedNode || !enemyNode) return null;
    return (
        <div style={{ background: "rgba(8,11,20,0.9)", border: "1px solid rgba(255,0,110,0.35)", borderRadius: 16, padding: "16px 20px", minWidth: 260, backdropFilter: "blur(12px)" }}>
            <div style={{ fontSize: 10, color: "#ff006e", letterSpacing: "0.3em", marginBottom: 6 }}>TARGET ACQUIRED</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{enemyNode.name.toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: "rgba(200,210,220,0.5)" }}>ENEMY TROOPS: {Math.floor(enemyNode.troops)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#00f5d4" }}>{selectedNode.name.toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: "rgba(200,210,220,0.5)" }}>YOURS: {Math.floor(selectedNode.troops)}</div>
                </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onPlanAttack} style={{ flex: 1, background: "rgba(255,0,110,0.15)", border: "1px solid rgba(255,0,110,0.4)", borderRadius: 8, padding: "10px", fontSize: 10, color: "#ff006e", cursor: "pointer", letterSpacing: "0.1em", fontFamily: "inherit" }}>
                    ⚔ PLAN ATTACK
                </button>
                {selectedNode.isAirbase && (
                    <button onClick={onAirstrike} style={{ flex: 1, background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.35)", borderRadius: 8, padding: "10px", fontSize: 10, color: "#ffd700", cursor: "pointer", letterSpacing: "0.1em", fontFamily: "inherit" }}>
                        ✈ AIRSTRIKE
                    </button>
                )}
            </div>
        </div>
    );
}
