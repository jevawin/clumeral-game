// confetti.js — canvas-based confetti burst on correct answer

const COLOURS = ["#ff6d5a", "#ff914d", "#4caf88", "#e8e8f0", "#a78bfa", "#38bdf8"];
const PIECE_COUNT = 160;
const DURATION_MS = 5500;
const GRAVITY = 0.25;

export function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const particles = [];

  for (let i = 0; i < PIECE_COUNT; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -0.5 - 10, // start above viewport
      vx: (Math.random() - 0.5) * 4,                // lateral drift
      vy: Math.random() * 3 + 1,                    // downward velocity
      w: Math.random() * 8 + 5,
      h: Math.random() * 5 + 4,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
      wobble: Math.random() * Math.PI * 2,           // wobble phase offset
      wobbleSpeed: Math.random() * 0.08 + 0.04,
      wobbleAmp: Math.random() * 3 + 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
    });
  }

  let rafId;
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    if (elapsed > DURATION_MS) {
      cancelAnimationFrame(rafId);
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let allOffscreen = true;
    for (const p of particles) {
      p.vy += GRAVITY;
      p.wobble += p.wobbleSpeed;
      p.x += p.vx + Math.sin(p.wobble) * p.wobbleAmp;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      if (p.y < canvas.height + 20) allOffscreen = false;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.colour;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (allOffscreen) {
      cancelAnimationFrame(rafId);
      canvas.remove();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
}
