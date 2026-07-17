import React from "react";

export default function AuroraBackground() {
  return (
    <div className="aurora-scene" aria-hidden="true">
      <div className="aurora-scene__night" />
      <div className="aurora-scene__stars aurora-scene__stars--a" />
      <div className="aurora-scene__stars aurora-scene__stars--b" />

      <div className="aurora-curtain aurora-curtain--left">
        <span />
        <span />
        <span />
      </div>
      <div className="aurora-curtain aurora-curtain--center">
        <span />
        <span />
      </div>
      <div className="aurora-curtain aurora-curtain--right">
        <span />
        <span />
        <span />
      </div>

      <div className="aurora-scene__horizon" />
      <div className="aurora-scene__vignette" />
    </div>
  );
}
