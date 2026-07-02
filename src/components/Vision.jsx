import '../styles/vision.css'
import vision from '../data/vision'

function Vision() {
    return (
        <section className="vision" id="about">

            <p className="section-tag">
                CEO Vision
            </p>

            <h2>
                {vision.title}
            </h2>

            <p className="vision-description">
                {vision.description}
            </p>

            <div className="vision-values">

                {vision.values.map((value) => (

                    <div
                        className="vision-value"
                        key={value}
                    >
                        {value}
                    </div>

                ))}

            </div>

        </section>
    )
}

export default Vision