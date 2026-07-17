import React from "react";

import AuroraMotion from "./AuroraMotion";

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
      <AuroraMotion />
      <div className="aurora-film__shade" />
    </div>
  );
}
