export default function RouteSelectBanner({ visible }) {
    if (!visible) return null;
    return (
        <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: "var(--ui-panel)", border: "1px solid color-mix(in srgb, var(--ui-accent) 46%, transparent)", borderRadius: 6, padding: "10px 24px", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", color: "var(--ui-accent)", pointerEvents: "none", textTransform: "uppercase", animation: "pulse 1.5s infinite" }}>
            Hover a route - click to confirm attack
        </div>
    );
}
