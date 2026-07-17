import React from "react";

export default function AuroraFilm() {
  return (
    <div className="aurora-film" aria-hidden="true">
      <picture className="aurora-film__picture">
        <source media="(max-width: 760px)" srcSet="/aurora-hero-mobile.png" />
        <img
          src="/aurora-hero-desktop.png"
          alt=""
          width="1792"
          height="1024"
          decoding="async"
          fetchPriority="high"
        />
      </picture>
      <div className="aurora-film__shade" />
    </div>
  );
}
