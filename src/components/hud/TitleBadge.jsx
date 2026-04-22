export default function TitleBadge() {
    return (
        <div style={{ position: "absolute", top: 16, left: 16, pointerEvents: "none" }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.15em", background: "linear-gradient(135deg,#00f5d4,#8338ec)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                MAPPY
            </div>
            <div style={{ fontSize: 8, letterSpacing: "0.4em", color: "rgba(200,220,230,0.3)", marginTop: 2 }}>CONQUEST ENGINE</div>
        </div>
    );
}
