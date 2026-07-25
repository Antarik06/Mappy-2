export default function EndScreen({ outcome, stats, onRestart, onQuit }) {
    const victory = outcome.result === "victory";

    return (
        <div className="end">
            <div className="panel end-card">
                <h1 className={`end-verdict ${outcome.result}`}>
                    {victory ? "The map is yours" : "The line broke"}
                </h1>
                <p className="end-reason">{outcome.reason}</p>

                <div className="end-stats">
                    <div className="stat">
                        <span className="stat-label">Held</span>
                        <span className="stat-value numeric">{stats.territories}</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Taken</span>
                        <span className="stat-value numeric">{stats.captures}</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Duration</span>
                        <span className="stat-value numeric">{stats.duration}</span>
                    </div>
                </div>

                <div className="end-actions">
                    <button className="btn btn-primary" type="button" onClick={onRestart}>
                        Fight this map again
                    </button>
                    <button className="btn" type="button" onClick={onQuit}>
                        New world
                    </button>
                </div>
            </div>
        </div>
    );
}
