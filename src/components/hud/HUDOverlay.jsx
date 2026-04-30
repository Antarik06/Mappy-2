import TitleBadge from './TitleBadge';
import RouteSelectBanner from './RouteSelectBanner';
import SelectedNodeCard from './SelectedNodeCard';
import AttackCard from './AttackCard';
import './HUDOverlay.css';

export default function HUDOverlay({ gs, selectedNode, enemyNode, onPlanAttack, onAirstrike, onUpgradeAirbase, onTogglePause, onToggleTheme, theme }) {

    return (
        <>
            {/* Top-left: Title */}
            <TitleBadge />

            <div className="hud-controls">
                <button className="hud-control-button" onClick={onTogglePause}>
                    {gs.paused ? "Resume" : "Pause"}
                </button>
                <button className="hud-control-button" onClick={onToggleTheme}>
                    {theme === "dark" ? "Light" : "Dark"}
                </button>
            </div>

            {gs.paused && (
                <div className="pause-overlay">
                    <div className="pause-label">Paused</div>
                    <div className="pause-copy">The battlefield is frozen exactly here.</div>
                </div>
            )}

            {/* Route select banner */}
            <RouteSelectBanner visible={gs.mode === "route-select"} />

            {/* Bottom controls */}
            <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                {/* Selected node card */}
                {selectedNode && !enemyNode && gs.mode === "normal" && (
                    <SelectedNodeCard node={selectedNode} onUpgradeAirbase={onUpgradeAirbase} />
                )}

                {/* Attack card */}
                {selectedNode && enemyNode && gs.mode === "normal" && (
                    <AttackCard
                        selectedNode={selectedNode}
                        enemyNode={enemyNode}
                        onPlanAttack={onPlanAttack}
                        onAirstrike={onAirstrike}
                    />
                )}
            </div>
        </>
    );
}
