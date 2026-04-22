export default function RouteSelectBanner({ visible }) {
    if (!visible) return null;
    return (
        <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.4)", borderRadius: 50, padding: "10px 24px", fontSize: 11, letterSpacing: "0.2em", color: "#00ff88", pointerEvents: "none", textTransform: "uppercase", animation: "pulse 1.5s infinite" }}>
            ⟶ HOVER A ROUTE · CLICK TO CONFIRM ATTACK
        </div>
    );
}
