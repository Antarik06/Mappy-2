export default function GameOverScreen({ won, onRestart }) {
    return (
        <div style={{ position: "absolute", inset: 0, background: "rgba(8,11,20,0.92)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "clamp(72px,12vw,140px)", margin: 0, lineHeight: 1 }}>
                    {won ? "🏆" : "💀"}
                </div>
                <h2 style={{ fontSize: "clamp(40px,6vw,80px)", margin: "16px 0 8px", letterSpacing: "-0.02em", background: won ? "linear-gradient(135deg,#00f5d4,#8338ec)" : "linear-gradient(135deg,#ff006e,#fb5607)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {won ? "VICTORY" : "DEFEATED"}
                </h2>
                <p style={{ color: "rgba(200,210,220,0.6)", fontSize: 13, letterSpacing: "0.3em", marginBottom: 40, textTransform: "uppercase" }}>
                    {won ? "The network bends to your will." : "Your empire has fallen to silence."}
                </p>
                <button
                    onClick={onRestart}
                    style={{ background: "linear-gradient(135deg, #00f5d4, #8338ec)", border: "none", borderRadius: 50, padding: "16px 48px", fontSize: 13, fontWeight: 700, letterSpacing: "0.2em", color: "#080b14", cursor: "pointer", textTransform: "uppercase" }}
                >
                    PLAY AGAIN
                </button>
            </div>
        </div>
    );
}
