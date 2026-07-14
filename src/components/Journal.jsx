import "../styles/journal.css";
import journal from "../data/journal";

function Journal() {
    return (
        <section className="journal" id="development">

            <p className="section-tag">
                Development Center
            </p>

            <h2>
                Building Aurora,
                one sprint at a time.
            </h2>

            <p className="journal-intro">
                Follow every sprint, battle test, and milestone across the Aurora ecosystem.
            </p>

            <div className="journal-grid">

                {journal.map((item) => (

                    <div
                        className="journal-card"
                        key={item.id}
                    >

                        <div className="journal-top">

                            <span className="journal-date">
                                {item.date}
                            </span>

                            <span className="journal-status">
                                <span aria-hidden="true">•</span>
                                {item.status}
                            </span>

                        </div>

                        <h3>
                            {item.title}
                        </h3>

                        <p className="journal-summary">
                            {item.summary}
                        </p>

                        <div className="journal-meta">

                            <span>
                                {item.product}
                            </span>

                            <span>
                                {item.version}
                            </span>

                            <span>
                                {item.sprint}
                            </span>

                        </div>

                        <div className="progress">

                            <div
                                className="progress-fill"
                                style={{
                                    width: `${item.progress}%`
                                }}
                            />

                        </div>

                        <div className="journal-footer">

                            <span>
                                {item.progress}% Complete
                            </span>

                            <button className="journal-button" type="button">
                                View Changelog -&gt;
                            </button>

                        </div>

                    </div>

                ))}

            </div>

        </section>
    );
}

export default Journal;
