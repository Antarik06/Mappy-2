import { useCallback, useState } from "react";
import MenuScreen from "./MenuScreen";
import GameScreen from "./GameScreen";
import { randomSeedString } from "../engine/rng";
import "./styles.css";

export default function App() {
    const [session, setSession] = useState(null);

    const start = useCallback(({ seed, difficulty }) => {
        const finalSeed = (seed || "").trim().toUpperCase() || randomSeedString();
        // A key change forces a clean GameScreen, so no state leaks between matches.
        setSession({ seed: finalSeed, difficulty, key: `${finalSeed}:${difficulty}:${Date.now()}` });
    }, []);

    const quit = useCallback(() => setSession(null), []);

    if (!session) return <MenuScreen onStart={start} />;

    return (
        <GameScreen
            key={session.key}
            seed={session.seed}
            difficulty={session.difficulty}
            onQuit={quit}
            onRestart={() => start({ seed: session.seed, difficulty: session.difficulty })}
        />
    );
}
