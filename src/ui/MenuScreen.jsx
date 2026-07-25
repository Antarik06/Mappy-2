import { useState } from "react";
import { DIFFICULTIES, GAME } from "../engine/config";
import { randomSeedString } from "../engine/rng";
import BattleBackdrop from "./BattleBackdrop";
import HowToPlay from "./HowToPlay";
import { sfx } from "../audio/sfx";

/**
 * Landing screen: a live battle behind a single centred column of controls.
 *
 * Everything is sized to fit one viewport — no inner scroll container, since
 * that produces a scrollbar that reads as a sidebar and clips the title.
 */
export default function MenuScreen({ onStart }) {
    const [seed, setSeed] = useState("");
    const [difficulty, setDifficulty] = useState("commander");
    const [showHelp, setShowHelp] = useState(false);

    const begin = () => {
        sfx.select();
        onStart({ seed, difficulty });
    };

    const words = GAME.name.split(" ");
    const active = DIFFICULTIES[difficulty];

    return (
        <div className="menu">
            <BattleBackdrop />
            <div className="menu-scrim" />

            <div className="menu-stage">
                <header className="menu-hero">
                    <div className="live-badge">
                        <span className="live-dot" />
                        Live front · unfolding now
                    </div>

                    <h1 className="menu-title">
                        {words.map((w) => (
                            <span className="menu-title-line" key={w}>{w}</span>
                        ))}
                    </h1>
                    <p className="menu-tagline">{GAME.tagline}</p>
                </header>

                <div className="menu-controls">
                    <div className="control-block">
                        <label className="eyebrow field-label" htmlFor="seed">World seed</label>
                        <div className="seed-row">
                            <input
                                id="seed"
                                className="seed-input"
                                value={seed}
                                maxLength={14}
                                placeholder="Blank for a new world"
                                onChange={(e) => setSeed(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") begin(); }}
                            />
                            <button className="btn" type="button" onClick={() => setSeed(randomSeedString())}>
                                Roll
                            </button>
                        </div>
                    </div>

                    <div className="control-block">
                        <span className="eyebrow field-label">Opposition</span>
                        {/* Three across, so the blurb below is the only prose —
                            keeps the whole screen inside one viewport. */}
                        <div className="difficulty-row">
                            {Object.values(DIFFICULTIES).map((d) => (
                                <button
                                    key={d.id}
                                    type="button"
                                    className="difficulty"
                                    aria-pressed={difficulty === d.id}
                                    onClick={() => { setDifficulty(d.id); sfx.select(); }}
                                >
                                    <span className="difficulty-name">{d.label}</span>
                                    <span className="difficulty-rivals">
                                        {d.aiCount} {d.aiCount === 1 ? "rival" : "rivals"}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <p className="difficulty-blurb">{active.blurb}</p>
                    </div>
                </div>

                <div className="menu-actions">
                    <button className="btn btn-primary" type="button" onClick={begin}>
                        Take the field
                    </button>
                    <button className="btn" type="button" onClick={() => setShowHelp(true)}>
                        How to play
                    </button>
                </div>
            </div>

            {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
        </div>
    );
}
