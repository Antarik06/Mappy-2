export default function TitleBadge() {
    return (
        <div style={{ position: "absolute", top: 16, left: 16, pointerEvents: "none" }}>
            <div style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: 22, fontWeight: 950, letterSpacing: "0", color: "var(--ui-title)", textTransform: "uppercase", textShadow: "0 8px 32px var(--ui-title-glow)" }}>
                MAPPY
            </div>
            <div style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: 8, fontWeight: 800, letterSpacing: "0.26em", color: "var(--ui-muted)", marginTop: 2 }}>CONQUEST ENGINE</div>
        </div>
    );
}
