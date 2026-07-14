function ProductReleaseNotes({ notes = [] }) {
    if (!notes.length) {
        return null;
    }

    return (
        <section className="product-section">
            <h3>Release Notes</h3>

            <div className="release-list">
                {notes.map((note) => (
                    <article className="release-card" key={`${note.version}-${note.date}`}>
                        <div>
                            <span>{note.version}</span>
                            <time dateTime={note.date}>{note.date}</time>
                        </div>
                        <p>{note.summary}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default ProductReleaseNotes;
