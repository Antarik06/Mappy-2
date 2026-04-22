import { OWNER_COLORS } from '../../game/constants';

export default function SelectedNodeCard({ node, onUpgradeAirbase }) {
    if (!node) return null;
    return (
        <div style={{ background: "rgba(8,11,20,0.9)", border: `1px solid ${OWNER_COLORS["player"]}44`, borderRadius: 16, padding: "16px 20px", minWidth: 220, backdropFilter: "blur(12px)" }}>
            <div style={{ fontSize: 10, color: OWNER_COLORS["player"], letterSpacing: "0.3em", marginBottom: 6 }}>SELECTED NODE</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 10 }}>{node.name.toUpperCase()}</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(200,210,220,0.6)", marginBottom: 12 }}>
                <span>TROOPS: {Math.floor(node.troops)}/{node.maxTroops}</span>
                <span>{node.isAirbase ? "✈ AIRBASE" : "⊕ GROUND"}</span>
            </div>
            {!node.isAirbase && (
                <button
                    onClick={onUpgradeAirbase}
                    disabled={node.troops < 50}
                    style={{ width: "100%", background: node.troops >= 50 ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${node.troops >= 50 ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "8px", fontSize: 10, color: node.troops >= 50 ? "#ffd700" : "rgba(200,210,220,0.3)", cursor: node.troops >= 50 ? "pointer" : "not-allowed", letterSpacing: "0.15em" }}
                >
                    ✈ BUILD AIRBASE (50 troops)
                </button>
            )}
            {node.isAirbase && (
                <div style={{ textAlign: "center", fontSize: 10, color: "#ffd700", padding: "6px", border: "1px solid rgba(255,215,0,0.3)", borderRadius: 8 }}>✈ AIRBASE ACTIVE — SELECT A TARGET</div>
            )}
        </div>
    );
}
