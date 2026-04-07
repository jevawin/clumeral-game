// bubbles.ts — canvas-based rising bubbles on correct answer.
// Replaces the old confetti burst. Sea creature + confetti was a thematic
// mismatch; bubbles fit Octo's aquatic world.

const TOTAL_MS = 5500; // every bubble must be off the top of the screen by this time
const MIN_COUNT = 20;
const MAX_COUNT = 30;

// Fallback accent if --acc can't be parsed (matches the default green).
const FALLBACK_ACC: [number, number, number] = [10, 133, 10];

type SizeBand = "small" | "medium" | "large";

interface Bubble {
  x: number;
  startY: number;
  size: number; // diameter
  delay: number; // ms before this bubble starts rising
  duration: number; // ms to rise from startY to fully off-screen
}

function pickSize(): SizeBand {
  // Weighted: more small than large, gives depth.
  const r = Math.random();
  if (r < 0.5) return "small";
  if (r < 0.85) return "medium";
  return "large";
}

function sizePx(band: SizeBand): number {
  // ± jitter so no two bubbles are identical.
  const jitter = (base: number, amp: number) => base + (Math.random() - 0.5) * amp;
  switch (band) {
    case "small": return jitter(16, 6);
    case "medium": return jitter(32, 10);
    case "large": return jitter(64, 16);
  }
}

function baseDuration(band: SizeBand): number {
  // Smaller = faster. Roughly matches the reference CodePen (4.6 / 4.9 / 5.0s).
  switch (band) {
    case "small": return 4400;
    case "medium": return 4700;
    case "large": return 5000;
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function parseAccent(raw: string): [number, number, number] {
  // Assumes --acc is set via light-dark(hex, hex) in style.css, which
  // getComputedStyle resolves to "rgb(r, g, b)". If --acc is ever set to a
  // raw hex or non-rgb colour space, we fall back silently to FALLBACK_ACC.
  const m = raw.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return FALLBACK_ACC;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function launchBubbles(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Handle hi-DPI: size the backing buffer by devicePixelRatio so the glow
  // and shine stay crisp on retina, then scale the drawing context once.
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);

  const ctxOrNull = canvas.getContext("2d");
  if (!ctxOrNull) {
    canvas.remove();
    return;
  }
  const ctx = ctxOrNull;
  ctx.scale(dpr, dpr);

  const bubbles: Bubble[] = [];
  const count = MIN_COUNT + Math.floor(Math.random() * (MAX_COUNT - MIN_COUNT + 1));

  for (let i = 0; i < count; i++) {
    const band = pickSize();
    const size = sizePx(band);
    const duration = baseDuration(band) + (Math.random() - 0.5) * 300;
    // Cap delay so delay + duration never exceeds the total budget.
    const maxDelay = Math.max(0, TOTAL_MS - duration);
    const delay = Math.random() * maxDelay;
    bubbles.push({
      x: Math.random() * cssWidth,
      startY: cssHeight + size,
      size,
      delay,
      duration,
    });
  }

  const root = document.documentElement;
  let rafId: number;
  const start = performance.now();

  function tick(now: number): void {
    const elapsed = now - start;
    if (elapsed > TOTAL_MS) {
      cancelAnimationFrame(rafId);
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Read accent once per frame so bubbles re-tint live if Octo's colour changes.
    const [ar, ag, ab] = parseAccent(
      getComputedStyle(root).getPropertyValue("--acc")
    );

    for (const b of bubbles) {
      const localT = (elapsed - b.delay) / b.duration;
      if (localT <= 0 || localT >= 1) continue;

      // Rise distance: from startY up until fully off-screen top.
      const riseDistance = b.startY + b.size;
      const y = b.startY - riseDistance * easeInOut(localT);

      // Fade in over first 10%, hold, fade out over last 10%.
      let opacity = 1;
      if (localT < 0.1) opacity = localT / 0.1;
      else if (localT > 0.9) opacity = (1 - localT) / 0.1;

      const r = b.size / 2;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(b.x, y);

      // 1. Base translucent white fill.
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fill();

      // 2. Inner glow in the accent colour — radial gradient transparent → accent at the edge.
      //    Scales naturally with bubble size (no fixed pixel blur).
      const glow = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
      glow.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0)`);
      glow.addColorStop(0.7, `rgba(${ar}, ${ag}, ${ab}, 0.35)`);
      glow.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0.55)`);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // 3. Rotated shine ellipse, upper-left.
      //    ~40% × 18% of bubble size, rotated -20deg, offset up and left.
      ctx.save();
      ctx.translate(-r * 0.2, -r * 0.45);
      ctx.rotate((-20 * Math.PI) / 180);
      ctx.beginPath();
      ctx.ellipse(0, 0, b.size * 0.2, b.size * 0.09, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fill();
      ctx.restore();

      ctx.restore();
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
}
