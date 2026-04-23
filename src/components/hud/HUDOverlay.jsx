import TitleBadge from './TitleBadge';
import RouteSelectBanner from './RouteSelectBanner';
import SelectedNodeCard from './SelectedNodeCard';
import AttackCard from './AttackCard';

export default function HUDOverlay({ gs, selectedNode, enemyNode, onPlanAttack, onAirstrike, onUpgradeAirbase }) {

    return (
        <>
            {/* Top-left: Title */}
            <TitleBadge />

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
