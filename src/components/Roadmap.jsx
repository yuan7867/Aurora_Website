import '../styles/roadmap.css'
import roadmap from '../data/roadmap'

function Roadmap() {
    return (
        <section className="roadmap" id="roadmap">

            <p className="section-tag">
                Product Roadmap
            </p>

            <h2>
                Where Aurora is heading.
            </h2>

            <p className="roadmap-intro">
                Every milestone represents the long-term vision of the Aurora ecosystem.
            </p>

            <div className="roadmap-grid">

                {roadmap.map((item) => (

                    <div
                        className="roadmap-card"
                        key={item.id}
                    >

                        <span className="roadmap-phase">
                            {item.phase}
                        </span>

                        <h3>
                            {item.title}
                        </h3>

                        <p className="roadmap-description">
                            {item.description}
                        </p>

                        <div className="roadmap-footer">

                            <span className="roadmap-status">
                                ● {item.status}
                            </span>

                        </div>

                    </div>

                ))}

            </div>

        </section>
    )
}

export default Roadmap