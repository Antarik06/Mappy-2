export default function SelectedNodeCard({ node, onUpgradeAirbase }) {
    if (!node) return null;
    return (
        <div style={{ background: "var(--ui-panel)", border: "1px solid color-mix(in srgb, var(--ui-accent) 42%, transparent)", borderRadius: 8, padding: "16px 20px", minWidth: 220, backdropFilter: "blur(12px)", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
            <div style={{ fontSize: 10, color: "var(--ui-accent)", letterSpacing: "0.18em", fontWeight: 900, marginBottom: 6 }}>SELECTED NODE</div>
            <div style={{ fontSize: 16, fontWeight: 850, color: "var(--ui-text)", marginBottom: 10 }}>{node.name.toUpperCase()}</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 18, fontSize: 10, color: "var(--ui-muted)", marginBottom: 12 }}>
                <span>TROOPS: {Math.floor(node.troops)}/{node.maxTroops}</span>
                <span>{node.isAirbase ? "AIRBASE" : "GROUND"}</span>
            </div>
            {!node.isAirbase && (
                <button
                    onClick={onUpgradeAirbase}
                    disabled={node.troops < 50}
                    style={{ width: "100%", background: node.troops >= 50 ? "color-mix(in srgb, var(--ui-accent) 16%, transparent)" : "rgba(120,120,120,0.08)", border: `1px solid ${node.troops >= 50 ? "color-mix(in srgb, var(--ui-accent) 42%, transparent)" : "var(--ui-border)"}`, borderRadius: 6, padding: "8px", fontSize: 10, color: node.troops >= 50 ? "var(--ui-accent)" : "var(--ui-muted)", cursor: node.troops >= 50 ? "pointer" : "not-allowed", letterSpacing: "0.1em", fontWeight: 900, fontFamily: "inherit" }}
                >
                    BUILD AIRBASE (50 troops)
                </button>
            )}
            {node.isAirbase && (
                <div style={{ textAlign: "center", fontSize: 10, color: "var(--ui-accent)", padding: "6px", border: "1px solid color-mix(in srgb, var(--ui-accent) 36%, transparent)", borderRadius: 6 }}>AIRBASE ACTIVE - SELECT A TARGET</div>
            )}
        </div>
    );
}
