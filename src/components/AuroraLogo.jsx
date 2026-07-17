import React from "react";

export default function AuroraLogo({ compact = false, className = "" }) {
  return (
    <div className={`aurora-brand ${className}`.trim()} aria-label="Aurora HY">
      <svg
        className="aurora-brand__mark"
        viewBox="0 0 72 72"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="aurora-logo-main" x1="8" y1="8" x2="62" y2="64">
            <stop offset="0" stopColor="#dffbff" />
            <stop offset="0.34" stopColor="#63ddff" />
            <stop offset="0.7" stopColor="#7f74ff" />
            <stop offset="1" stopColor="#d7a9ff" />
          </linearGradient>
          <linearGradient id="aurora-logo-gold" x1="36" y1="4" x2="36" y2="68">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.62" stopColor="#7ae7ff" />
            <stop offset="1" stopColor="#e6bb68" />
          </linearGradient>
          <filter id="aurora-logo-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M36 7 39.5 25.5 54 18 44.5 32 63 36 44.5 40 54 54 39.5 46.5 36 65 32.5 46.5 18 54 27.5 40 9 36 27.5 32 18 18 32.5 25.5Z"
            stroke="url(#aurora-logo-main)"
            strokeWidth="2.1"
            opacity="0.96"
            filter="url(#aurora-logo-glow)"
          />
          <path d="M36 5v60" stroke="url(#aurora-logo-gold)" strokeWidth="1.2" opacity="0.9" />
          <path d="M14 36h44" stroke="url(#aurora-logo-main)" strokeWidth="0.8" opacity="0.42" />
          <path d="M28 27c-7 3-11 9-12 19" stroke="#5de0ff" strokeWidth="2" opacity="0.55" />
          <path d="M44 27c7 3 11 9 12 19" stroke="#9a7cff" strokeWidth="2" opacity="0.55" />
        </g>
        <circle cx="36" cy="36" r="5.1" fill="#07101f" stroke="#bdf7ff" strokeWidth="1.5" />
        <circle cx="36" cy="36" r="1.8" fill="#ffffff" />
      </svg>

      {!compact && (
        <span className="aurora-brand__copy">
          <strong>AURORA HY</strong>
          <small>PROFESSIONAL AI TRADING SYSTEMS</small>
        </span>
      )}
    </div>
  );
}
