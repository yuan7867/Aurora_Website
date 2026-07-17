import React from "react";

const ribbons = [
  "aurora-motion__ribbon aurora-motion__ribbon--left aurora-motion__ribbon--cyan",
  "aurora-motion__ribbon aurora-motion__ribbon--left aurora-motion__ribbon--violet",
  "aurora-motion__ribbon aurora-motion__ribbon--center aurora-motion__ribbon--blue",
  "aurora-motion__ribbon aurora-motion__ribbon--right aurora-motion__ribbon--violet",
  "aurora-motion__ribbon aurora-motion__ribbon--right aurora-motion__ribbon--gold",
];

export default function AuroraMotion() {
  return (
    <div className="aurora-motion" aria-hidden="true">
      <div className="aurora-motion__veil" />
      {ribbons.map((className) => (
        <span className={className} key={className} />
      ))}
      <div className="aurora-motion__horizon" />
    </div>
  );
}
