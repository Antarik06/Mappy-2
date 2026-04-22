export default function MenuScreen({ onStart }) {
    return (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#080b14" }}>
            {/* Animated bg grid */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(0,245,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,212,0.04) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

            <div style={{ position: "relative", textAlign: "center", padding: "0 20px" }}>
                <div style={{ fontSize: 11, letterSpacing: "0.35em", color: "#00f5d4", opacity: 0.7, marginBottom: 16, textTransform: "uppercase" }}>
                    A Graph Strategy Experience
                </div>
                <h1 style={{ fontSize: "clamp(64px,10vw,120px)", fontWeight: 900, lineHeight: 1, margin: 0, letterSpacing: "-0.03em", background: "linear-gradient(135deg, #00f5d4 0%, #8338ec 60%, #ff006e 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    MAPPY
                </h1>
                <div style={{ fontSize: 13, letterSpacing: "0.5em", color: "rgba(200,210,220,0.5)", marginTop: 8, marginBottom: 48, textTransform: "uppercase" }}>
                    Territorial Conquest Engine
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 40, textAlign: "left", maxWidth: 480, margin: "0 auto 40px" }}>
                    {[
                        ["⚔️", "Drag to Attack", "Draw from your node to any enemy"],
                        ["🗺️", "Plan Routes", "Click attack, pick from Dijkstra paths"],
                        ["✈️", "Airbases", "Upgrade nodes to launch jet strikes"],
                        ["💣", "Ambush", "Click a road to trap enemy swarms"],
                    ].map(([ic, t, d]) => (
                        <div key={t} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px" }}>
                            <div style={{ fontSize: 20, marginBottom: 4 }}>{ic}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#00f5d4", letterSpacing: "0.1em", marginBottom: 3 }}>{t}</div>
                            <div style={{ fontSize: 10, color: "rgba(180,190,200,0.6)", lineHeight: 1.4 }}>{d}</div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={onStart}
                    style={{ background: "linear-gradient(135deg, #00f5d4, #8338ec)", border: "none", borderRadius: 50, padding: "18px 56px", fontSize: 14, fontWeight: 700, letterSpacing: "0.25em", color: "#080b14", cursor: "pointer", textTransform: "uppercase", boxShadow: "0 0 40px rgba(0,245,212,0.4), 0 0 80px rgba(131,56,236,0.2)" }}
                >
                    DEPLOY FORCES
                </button>
                <div style={{ marginTop: 16, fontSize: 10, color: "rgba(180,190,200,0.35)", letterSpacing: "0.15em" }}>
                    SCROLL TO ZOOM · DRAG EMPTY SPACE TO PAN
                </div>
            </div>
        </div>
    );
}
