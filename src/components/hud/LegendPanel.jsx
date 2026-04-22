import { OWNER_COLORS } from '../../game/constants';

export default function LegendPanel() {
    return (
        <div style={{ position: "absolute", bottom: 20, right: 20, background: "rgba(8,11,20,0.8)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px", fontSize: 10, color: "rgba(200,210,220,0.6)" }}>
            <div style={{ marginBottom: 8, letterSpacing: "0.3em", color: "rgba(200,210,220,0.4)" }}>LEGEND</div>
            {[["player", "YOU"], ["ai1", "ENEMY α"], ["ai2", "ENEMY β"], ["ai3", "ENEMY γ"], ["neutral", "NEUTRAL"]].map(([o, l]) => (
                <div key={o} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: OWNER_COLORS[o], boxShadow: `0 0 6px ${OWNER_COLORS[o]}` }} />
                    <span style={{ color: o === "player" ? "#00f5d4" : "rgba(200,210,220,0.6)" }}>{l}</span>
                </div>
            ))}
            <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8, fontSize: 9, color: "rgba(200,210,220,0.3)", lineHeight: 1.6 }}>
                SCROLL: zoom · DRAG SPACE: pan<br />
                CLICK ROAD: ambush (20 troops)
            </div>
        </div>
    );
}
