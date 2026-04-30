import LandingGraphPreview from './LandingGraphPreview';
import './MenuScreen.css';

export default function MenuScreen({ onStart, theme, onToggleTheme }) {
    return (
        <div className="menu-screen">
            <LandingGraphPreview theme={theme} />

            <main className="menu-content">
                <div className="menu-topline">
                    <div className="menu-kicker">Live territory simulation</div>
                    <button className="menu-theme-button" onClick={onToggleTheme}>{theme === "dark" ? "Light" : "Dark"} mode</button>
                </div>
                <h1 className="menu-title">Mappy</h1>
                <p className="menu-subtitle">Break the map open before rival networks choke your routes.</p>
                <p className="menu-copy">
                    A procedural graph war where momentum matters. Capture fast, hold the front,
                    and watch your forces pour through the enemy line.
                </p>

                <div className="menu-actions">
                    <button className="menu-start" onClick={onStart}>Start Conquest</button>
                    <div className="menu-status">Procedural map<br />Aggressive swarm preview</div>
                </div>

                <section className="menu-stats" aria-label="Game features">
                    <div className="menu-stat">
                        <strong>30</strong>
                        <span>territories per run</span>
                    </div>
                    <div className="menu-stat">
                        <strong>3</strong>
                        <span>enemy factions</span>
                    </div>
                    <div className="menu-stat">
                        <strong>Live</strong>
                        <span>routes, raids, and pressure</span>
                    </div>
                </section>
            </main>
        </div>
    );
}
