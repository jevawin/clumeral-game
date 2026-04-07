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

function randomDuration(): number {
  // Each bubble gets its own fixed linear speed, somewhere between
  // 4500ms and 5500ms. Nothing too fast, nothing overshoots the budget.
  return 4500 + Math.random() * 1000;
}

function parseRgb(raw: string): [number, number, number] | null {
  // Matches "rgb(r, g, b)" / "rgba(r, g, b, a)" — what getComputedStyle
  // returns after resolving light-dark() and SVG fill animations.
  const m = raw.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return null;
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
    const duration = randomDuration();
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

  // Octo's celebration cycles through 4 colours via the `octo-colours`
  // CSS keyframe on its first SVG path (see style.css). Reading the
  // computed `fill` of that path each frame gives us Octo's live colour,
  // which is what we want bubbles to match. --acc is the fallback if the
  // octo isn't on-screen yet.
  const root = document.documentElement;
  const octoPath = document.querySelector<SVGPathElement>(
    "[data-octo] > path"
  );

  let rafId: number;
  const start = performance.now();

  function readOctoColour(): [number, number, number] {
    if (octoPath) {
      const fill = getComputedStyle(octoPath).fill;
      const parsed = parseRgb(fill);
      if (parsed) return parsed;
    }
    const accParsed = parseRgb(
      getComputedStyle(root).getPropertyValue("--acc")
    );
    return accParsed ?? FALLBACK_ACC;
  }

  function tick(now: number): void {
    const elapsed = now - start;
    if (elapsed > TOTAL_MS) {
      cancelAnimationFrame(rafId);
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const [ar, ag, ab] = readOctoColour();

    for (const b of bubbles) {
      const localT = (elapsed - b.delay) / b.duration;
      if (localT <= 0 || localT >= 1) continue;

      // Linear rise: fixed speed per bubble, no easing.
      const riseDistance = b.startY + b.size;
      const y = b.startY - riseDistance * localT;

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
