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

        <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#aurora-logo-glow)">
          <path d="M36 6 38.4 16.6 47 12 41.8 21 52 23.7 41.8 26.4 47 35 38.4 30.6 36 42 33.6 30.6 25 35 30.2 26.4 20 23.7 30.2 21 25 12 33.6 16.6Z" stroke="url(#aurora-logo-main)" strokeWidth="1.8" />
          <path d="M36 8v48" stroke="url(#aurora-logo-gold)" strokeWidth="1.25" opacity="0.9" />
          <path d="M33 27C25 31 19 39 18 57" stroke="#57ddff" strokeWidth="2.6" opacity="0.78" />
          <path d="M39 27C47 31 53 39 54 57" stroke="#9b7cff" strokeWidth="2.6" opacity="0.78" />
          <path d="M31 29C26 37 27 45 29 62" stroke="#78bfff" strokeWidth="1.9" opacity="0.52" />
          <path d="M41 29C46 37 45 45 43 62" stroke="#c69fff" strokeWidth="1.9" opacity="0.52" />
          <path d="M36 33C32 40 32.5 48 36 65 39.5 48 40 40 36 33Z" stroke="url(#aurora-logo-main)" strokeWidth="1.35" opacity="0.7" />
        </g>
        <circle cx="36" cy="24" r="3.8" fill="#07101f" stroke="#d9fbff" strokeWidth="1.25" />
        <circle cx="36" cy="24" r="1.35" fill="#ffffff" />
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
