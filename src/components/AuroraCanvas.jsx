import React, { useEffect, useRef } from "react";

const RIBBONS = [
  { x: 0.11, width: 0.045, color: [63, 222, 255], phase: 0.2, height: 0.72 },
  { x: 0.19, width: 0.075, color: [75, 175, 255], phase: 1.3, height: 0.88 },
  { x: 0.29, width: 0.035, color: [131, 106, 255], phase: 2.2, height: 0.65 },
  { x: 0.68, width: 0.04, color: [121, 100, 255], phase: 3.7, height: 0.72 },
  { x: 0.78, width: 0.08, color: [67, 218, 255], phase: 4.6, height: 0.9 },
  { x: 0.89, width: 0.045, color: [226, 181, 102], phase: 5.4, height: 0.69 },
];

function rgba([r, g, b], alpha) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawRibbon(ctx, width, height, ribbon, time, reducedMotion) {
  const baseX = width * ribbon.x;
  const ribbonWidth = Math.max(28, width * ribbon.width);
  const bottom = height * 1.04;
  const top = height * (1 - ribbon.height);
  const travel = reducedMotion ? 0 : Math.sin(time * 0.00012 + ribbon.phase) * height * 0.018;
  const drift = reducedMotion ? 0 : Math.sin(time * 0.00008 + ribbon.phase * 1.7) * width * 0.012;

  for (let layer = 0; layer < 5; layer += 1) {
    const spread = (layer - 2) * ribbonWidth * 0.17;
    const alpha = 0.12 - layer * 0.012;
    const gradient = ctx.createLinearGradient(0, bottom, 0, top);
    gradient.addColorStop(0, rgba(ribbon.color, 0));
    gradient.addColorStop(0.12, rgba(ribbon.color, alpha * 1.8));
    gradient.addColorStop(0.42, rgba(ribbon.color, alpha));
    gradient.addColorStop(0.78, rgba(ribbon.color, alpha * 0.42));
    gradient.addColorStop(1, rgba(ribbon.color, 0));

    ctx.beginPath();
    const steps = 42;
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps;
      const y = bottom - progress * (bottom - top) + travel;
      const wave = Math.sin(progress * 4.4 + time * 0.0001 + ribbon.phase) * ribbonWidth * 0.28;
      const fineWave = Math.sin(progress * 9.5 + ribbon.phase * 2.1) * ribbonWidth * 0.06;
      const x = baseX + drift + spread + wave + fineWave;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = gradient;
    ctx.lineWidth = ribbonWidth * (1.2 - layer * 0.14);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = rgba(ribbon.color, 0.36);
    ctx.shadowBlur = 18 + layer * 6;
    ctx.stroke();
  }
}

function drawScene(ctx, width, height, time, reducedMotion) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const horizon = ctx.createRadialGradient(
    width * 0.5,
    height * 0.98,
    0,
    width * 0.5,
    height * 0.98,
    width * 0.48,
  );
  horizon.addColorStop(0, "rgba(79, 207, 255, 0.18)");
  horizon.addColorStop(0.34, "rgba(74, 121, 255, 0.07)");
  horizon.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, height * 0.55, width, height * 0.45);

  RIBBONS.forEach((ribbon) => drawRibbon(ctx, width, height, ribbon, time, reducedMotion));
  ctx.restore();
}

export default function AuroraCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d", { alpha: true });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    let disposed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, rect.width, rect.height, 4000, reducedMotion);
    };

    const render = (time) => {
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      drawScene(ctx, rect.width, rect.height, time, reducedMotion);
      if (!reducedMotion) animationFrame = window.requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!reducedMotion) animationFrame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas ref={canvasRef} className="aurora-canvas" aria-hidden="true" />;
}
