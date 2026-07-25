import { COMMAND, MARCH } from "../../engine/config";
import FloatingCard from "./FloatingCard";

export default function CommandBar({
    command,
    income,
    fraction,
    onFraction,
    territories,
    troops,
    supplied,
    collapsed,
    onToggleCollapse,
}) {
    const pct = Math.round(fraction * 100);

    return (
        <FloatingCard
            className="commandbar"
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            header={
                <span className="card-peek">
                    <span className="eyebrow">Command</span>
                    <span className="command-value numeric">{Math.floor(command)}</span>
                </span>
            }
        >
            <div className="command-meter">
                <div className="command-head">
                    <span className="command-rate numeric">+{income.toFixed(2)}/s income</span>
                    <span className="numeric">{Math.floor(command)} / {COMMAND.max}</span>
                </div>
                <div className="meter">
                    <div className="meter-fill" style={{ width: `${(command / COMMAND.max) * 100}%` }} />
                </div>
            </div>

            <div className="commit">
                <div className="commit-head">
                    <span>Commitment</span>
                    <strong>{pct}%</strong>
                </div>
                <input
                    type="range"
                    min={MARCH.minSendFraction * 100}
                    max={MARCH.maxSendFraction * 100}
                    step={5}
                    value={pct}
                    onChange={(e) => onFraction(Number(e.target.value) / 100)}
                    aria-label="Share of the garrison to commit"
                />
            </div>

            <div className="tp-stats">
                <div className="stat">
                    <span className="stat-label">Holdings</span>
                    <span className="stat-value numeric">
                        {territories}
                        {supplied < territories && (
                            <span style={{ color: "var(--danger)", fontSize: 12 }}> ({territories - supplied} cut)</span>
                        )}
                    </span>
                </div>
                <div className="stat">
                    <span className="stat-label">Troops</span>
                    <span className="stat-value numeric">{troops}</span>
                </div>
            </div>
        </FloatingCard>
    );
}
