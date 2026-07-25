import { useEffect } from "react";

const RULES = [
    {
        icon: "⤳",
        title: "Give orders by dragging",
        body: "Press on one of <em>your</em> holdings and drag to a target. The readout tells you exactly how the fight resolves before you let go. Scroll while dragging to commit more or fewer troops.",
    },
    {
        icon: "⛓",
        title: "Supply is everything",
        body: "A holding only grows while an unbroken chain of your own territory links it back to your capital. Cut an enemy's chain and everything behind it stops growing and <em>starts bleeding out</em> — you never have to storm what you can strangle.",
    },
    {
        icon: "⛰",
        title: "Ground decides the fight",
        body: "Mountain passes multiply a defender's strength; woodland bites attackers as they arrive; plains and harbours are rich but hard to hold. Hatched borders have no road — nothing crosses there.",
    },
    {
        icon: "◈",
        title: "Spend command wisely",
        body: "Supplied territory earns command points. Forts keep paying while you are busy elsewhere, barracks compound in the rear, watchtowers see two steps into the fog.",
    },
    {
        icon: "◐",
        title: "You only see what you hold",
        body: "Ownership is always visible, but garrison strength is only known next to your own lines. A greyed number is <em>stale intel</em> — what your scouts saw last, not what is there now.",
    },
    {
        icon: "♛",
        title: "Winning",
        body: "Destroy every rival, or hold 70% of the map for twenty unbroken seconds. Lose your capital and your seat moves to your strongest holding — survivable, but it will cost you.",
    },
];

export default function HowToPlay({ onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="modal-backdrop" onClick={onClose} role="presentation">
            <div
                className="panel modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="How to play"
            >
                <h2>Drag. Sever. Hold.</h2>
                <p className="modal-sub">
                    Real time — nothing waits for you, and nothing waits for them either.
                </p>

                {RULES.map((rule) => (
                    <div className="rule" key={rule.title}>
                        <div className="rule-icon" aria-hidden="true">{rule.icon}</div>
                        <div>
                            <h3>{rule.title}</h3>
                            {/* Rule copy is authored here, not user input. */}
                            <p dangerouslySetInnerHTML={{ __html: rule.body }} />
                        </div>
                    </div>
                ))}

                <div style={{ marginTop: 22 }}>
                    <button className="btn btn-primary" type="button" onClick={onClose} style={{ width: "100%" }}>
                        Understood
                    </button>
                </div>
            </div>
        </div>
    );
}
