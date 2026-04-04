// Clumeral — octo.ts
// Octopus mascot animations: eye tracking, blink/wink, squint-glance,
// spring bounce, letter reveal, celebrate, sad, idle bob.

// ─── DOM references ─────────────────────────────────────────────────────────

const octoEl     = document.querySelector('[data-octo]') as HTMLElement | null;
const octoWrapEl = document.querySelector('[data-octo-wrap]') as HTMLElement | null;
const tlts       = [...document.querySelectorAll('.tlt')] as HTMLElement[];

// ── Eye / mouth elements ──
const eyeLR   = document.querySelector('[data-eye="l-round"]') as HTMLElement | null;
const eyeRR   = document.querySelector('[data-eye="r-round"]') as HTMLElement | null;
const eyeLS   = document.querySelector('[data-eye="l-squint"]') as HTMLElement | null;
const eyeRS   = document.querySelector('[data-eye="r-squint"]') as HTMLElement | null;
const eyeLX   = document.querySelector('[data-eye="l-x"]') as HTMLElement | null;
const eyeRX   = document.querySelector('[data-eye="r-x"]') as HTMLElement | null;
const mouthH  = document.querySelector('[data-mouth="happy"]') as HTMLElement | null;
const mouthS  = document.querySelector('[data-mouth="squint"]') as HTMLElement | null;
const mouthSad = document.querySelector('[data-mouth="sad"]') as HTMLElement | null;

// ─── Module state ───────────────────────────────────────────────────────────

let octoAnimating = false;
let exprMode = 'round';
let eyeTX = 0, eyeTY = 0, eyeX = 0, eyeY = 0;
let winkLeft = true;
let squintBusy = false;
let entryBusy = false, bobT = 0;

// ─── Eye tracking ───────────────────────────────────────────────────────────

document.addEventListener('mousemove', (e) => {
  if (exprMode !== 'squint-glancing') {
    if (!octoEl) return;
    const r  = octoEl.getBoundingClientRect();
    const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    eyeTX = cl((e.clientX - (r.left + r.width  / 2)) / 55, -1.8,  1.8);
    eyeTY = cl((e.clientY - (r.top  + r.height / 2)) / 55, -1.5,  1.5);
  }
});

(function trackEyes() {
  eyeX += (eyeTX - eyeX) * 0.12;
  eyeY += (eyeTY - eyeY) * 0.12;
  eyeLR?.setAttribute('cx', String(19 + eyeX)); eyeLR?.setAttribute('cy', String(15 + eyeY));
  eyeRR?.setAttribute('cx', String(33 + eyeX)); eyeRR?.setAttribute('cy', String(15 + eyeY));
  eyeLS?.setAttribute('transform', `translate(${eyeX},${eyeY})`);
  eyeRS?.setAttribute('transform', `translate(${eyeX},${eyeY})`);
  requestAnimationFrame(trackEyes);
})();

// ─── Blink / wink ───────────────────────────────────────────────────────────

function winkEye(eye: Element | null, cb?: () => void) {
  if (!eye) return;
  const dur = 140, s = performance.now();
  (function f(now: number) {
    const t = Math.min((now - s) / dur, 1);
    eye.setAttribute('r', String(Math.max(0.1, 3 * Math.abs(Math.cos(t * Math.PI)))));
    if (t < 1) requestAnimationFrame(f);
    else { eye.setAttribute('r', '3'); if (cb) cb(); }
  })(performance.now());
}

function scheduleBlink() {
  setTimeout(() => {
    if (exprMode !== 'round') { scheduleBlink(); return; }
    const fi = winkLeft ? eyeLR : eyeRR;
    const se = winkLeft ? eyeRR : eyeLR;
    winkLeft = !winkLeft;
    winkEye(fi, () => setTimeout(() => winkEye(se, scheduleBlink), 200));
  }, 2200 + Math.random() * 2000);
}
scheduleBlink();

// ─── Squint-glance ──────────────────────────────────────────────────────────

function fadeExpr(toSquint: boolean, dur: number, onDone?: () => void) {
  const s = performance.now();
  (function f(now: number) {
    const t = Math.min((now - s) / dur, 1);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const ra = toSquint ? 1 - e : e;
    const sa = toSquint ? e : 1 - e;
    [eyeLR, eyeRR].forEach((el) => el?.setAttribute('opacity', String(ra)));
    [eyeLS, eyeRS].forEach((el) => el?.setAttribute('opacity', String(sa)));
    mouthH?.setAttribute('opacity', String(ra));
    mouthS?.setAttribute('opacity', String(sa));
    if (t < 1) requestAnimationFrame(f);
    else {
      [eyeLR, eyeRR].forEach((el) => el?.setAttribute('opacity', toSquint ? '0' : '1'));
      [eyeLS, eyeRS].forEach((el) => el?.setAttribute('opacity', toSquint ? '1' : '0'));
      mouthH?.setAttribute('opacity', toSquint ? '0' : '1');
      mouthS?.setAttribute('opacity', toSquint ? '1' : '0');
      if (onDone) onDone();
    }
  })(performance.now());
}

function doSquint() {
  if (squintBusy || exprMode !== 'round') return;
  squintBusy = true; exprMode = 'transitioning';
  eyeLR?.setAttribute('r', '3'); eyeRR?.setAttribute('r', '3');
  fadeExpr(true, 260, () => {
    exprMode = 'squint-glancing';
    const glances = [{ tx: -1.5, ty: -0.6 }, { tx: 1.4, ty: -0.4 }, { tx: 0.3, ty: 0.9 }, { tx: 0, ty: 0 }];
    let gi = 0;
    function glance() {
      if (gi >= glances.length) {
        exprMode = 'transitioning';
        eyeLS?.removeAttribute('transform'); eyeRS?.removeAttribute('transform');
        fadeExpr(false, 260, () => { exprMode = 'round'; squintBusy = false; scheduleSquint(); });
        return;
      }
      const g = glances[gi++];
      const dur = 460 + Math.random() * 360;
      const s = performance.now(), fx = eyeTX, fy = eyeTY;
      (function mv(now: number) {
        const t = Math.min((now - s) / dur, 1);
        const e = 1 - Math.pow(1 - t, 3);
        eyeTX = fx + (g.tx - fx) * e;
        eyeTY = fy + (g.ty - fy) * e;
        if (t < 1) requestAnimationFrame(mv);
        else setTimeout(glance, 160 + Math.random() * 180);
      })(performance.now());
    }
    glance();
  });
}

function scheduleSquint() {
  setTimeout(() => { if (exprMode === 'round') doSquint(); else scheduleSquint(); },
    5000 + Math.random() * 5000);
}
scheduleSquint();

// ─── Spring bounce ──────────────────────────────────────────────────────────

function springBounce(cb?: () => void) {
  if (!octoWrapEl) return;
  const H = 56, dur = 660, s = performance.now();
  (function f(now: number) {
    const r = Math.min((now - s) / dur, 1);
    let y = 0, sx = 1, sy = 1;
    if (r < 0.38) {
      const p = r / 0.38, e = 1 - Math.pow(1 - p, 3);
      y = -e * H; sy = 1 + 0.10 * Math.sin(p * Math.PI); sx = 1 - 0.06 * Math.sin(p * Math.PI);
    } else if (r < 0.78) {
      const p = (r - 0.38) / 0.40;
      y = -(1 - p * p) * H;
    } else {
      const p = (r - 0.78) / 0.22;
      y = Math.exp(-13 * p) * Math.cos(Math.PI * p) * 10;
      const sq = Math.exp(-9 * p);
      sx = 1 + 0.28 * sq; sy = 1 - 0.22 * sq;
    }
    octoWrapEl!.style.transform = `translateY(${y}px) scaleX(${sx}) scaleY(${sy})`;
    if (r < 1) requestAnimationFrame(f);
    else { octoWrapEl!.style.transform = ''; if (cb) cb(); }
  })(performance.now());
}

// ─── Letter reveal ──────────────────────────────────────────────────────────

function resetOcto() {
  if (!octoWrapEl) return;
  octoWrapEl.style.transition = 'none';
  octoWrapEl.style.opacity    = '0';
  octoWrapEl.style.transform  = 'translateY(-0.75rem)';
}

function revealOcto(onDone?: () => void) {
  if (!octoWrapEl) return;
  void octoWrapEl.offsetWidth;
  octoWrapEl.style.transition = 'opacity 0.2s ease-out, transform 0.4s cubic-bezier(.34,1.56,.64,1)';
  octoWrapEl.style.opacity    = '1';
  octoWrapEl.style.transform  = 'translateY(0)';
  setTimeout(() => {
    if (!octoWrapEl) return;
    octoWrapEl.style.transition = '';
    octoWrapEl.style.transform  = '';
    if (onDone) onDone();
  }, 420);
}

function resetLetters() {
  tlts.forEach((l) => {
    l.style.transition = 'none';
    l.style.opacity    = '0';
    l.style.transform  = 'translateY(10px)';
  });
}

function revealLetters(onDone?: () => void) {
  tlts.forEach((l, i) => setTimeout(() => {
    l.style.transition = 'opacity .15s ease-out, transform .22s cubic-bezier(.34,1.56,.64,1)';
    l.style.opacity    = '1';
    l.style.transform  = 'translateY(0)';
    if (i === tlts.length - 1 && onDone) setTimeout(onDone, 120);
  }, i * 80));
}

function watchLetters(dur: number) {
  const s = performance.now();
  (function f(now: number) {
    const t  = Math.min((now - s) / dur, 1);
    const li = Math.min(Math.floor(t * tlts.length), tlts.length - 1);
    const el = tlts[li];
    if (el && octoEl) {
      const lr = el.getBoundingClientRect();
      const or = octoEl.getBoundingClientRect();
      if (lr.width > 0 && or.width > 0) {
        eyeTX = Math.max(-1.8, Math.min(1.8, (lr.left + lr.width  / 2 - (or.left + or.width  / 2)) / 40));
        eyeTY = Math.max(-1.5, Math.min(1.5, (lr.top  + lr.height / 2 - (or.top  + or.height / 2)) / 40));
      }
    }
    if (t < 1) requestAnimationFrame(f);
  })(performance.now());
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function runEntry(): void {
  if (entryBusy) return;
  entryBusy = true;
  resetLetters();
  resetOcto();
  revealOcto(() => {
    setTimeout(() => {
      const dur = tlts.length * 80 + 120;
      watchLetters(dur);
      revealLetters(() => setTimeout(() => springBounce(() => { entryBusy = false; }), 80));
    }, 80);
  });
}

export function setupOctoClick(): void {
  octoWrapEl?.addEventListener('click', () => { if (!entryBusy && !octoAnimating) runEntry(); });
}

export function celebrateOcto(): void {
  if (octoAnimating || !octoWrapEl || !octoEl) return;
  octoAnimating = true;

  const rect = octoWrapEl.getBoundingClientRect();
  const origLeft = rect.left;
  const origTop = rect.top;

  octoWrapEl.style.position = 'fixed';
  octoWrapEl.style.left = '50%';
  octoWrapEl.style.top = '50%';
  octoWrapEl.style.margin = '0';

  const ph = document.querySelector('[data-octo-placeholder]') as HTMLElement | null;
  if (ph) ph.classList.remove('hidden');

  octoEl.classList.add('celebrate');
  octoWrapEl.classList.add('celebrating');
  document.body.style.overflow = 'hidden';

  // After fly animation ends, transition back to header
  setTimeout(() => {
    if (!octoWrapEl || !octoEl) return;
    octoWrapEl.style.transform = 'translate(-50%, -50%)';
    octoWrapEl.classList.remove('celebrating');
    octoEl.classList.remove('celebrate');

    requestAnimationFrame(() => {
      if (!octoWrapEl) return;
      octoWrapEl.style.transition = 'left 0.6s ease-in-out, top 0.6s ease-in-out, transform 0.6s ease-in-out';
      octoWrapEl.style.left = origLeft + 'px';
      octoWrapEl.style.top = origTop + 'px';
      octoWrapEl.style.transform = '';

      setTimeout(() => {
        if (!octoWrapEl) return;
        octoWrapEl.style.position = '';
        octoWrapEl.style.left = '';
        octoWrapEl.style.top = '';
        octoWrapEl.style.margin = '';
        octoWrapEl.style.transition = '';
        octoWrapEl.style.opacity = '1';

        const ph = document.querySelector('[data-octo-placeholder]') as HTMLElement | null;
        if (ph) ph.classList.add('hidden');

        const digitsEl = document.querySelector('[data-digits]') as HTMLElement | null;
        if (digitsEl) digitsEl.classList.add('digit-correct');

        document.body.style.overflow = '';
        exprMode = 'round';
        octoAnimating = false;
      }, 650);
    });
  }, 5100);
}

function sadBounce(el: HTMLElement, fallDist: number, onDone: () => void): void {
  // Physics-based fall + damped bounce using requestAnimationFrame
  const gravity = 4800;   // px/s²
  const restitution = 0.3; // bounce damping
  const minBounce = 2;     // stop bouncing below this height
  let y = 0, velocity = 0, landed = false;
  let prev = performance.now();

  (function frame(now: number) {
    const dt = Math.min((now - prev) / 1000, 0.033); // cap at ~30fps delta
    prev = now;
    velocity += gravity * dt;
    y += velocity * dt;

    if (y >= fallDist) {
      y = fallDist;
      landed = true;
      velocity = -velocity * restitution;
      if (Math.abs(velocity) < minBounce * gravity * 0.01) {
        y = fallDist;
        el.style.transform = `translateX(-50%) translateY(${y}px) rotate(90deg)`;
        onDone();
        return;
      }
    }

    // Rotate to 90° during initial fall, lock at 90° once landed
    const rot = landed ? 90 : Math.min(y / fallDist, 1) * 90;
    el.style.transform = `translateX(-50%) translateY(${y}px) rotate(${rot}deg)`;
    requestAnimationFrame(frame);
  })(performance.now());
}

export function sadOcto(): void {
  if (octoAnimating || !octoWrapEl) return;
  octoAnimating = true;
  exprMode = 'sad';

  const setOpacity = (el: HTMLElement | null, val: string) => { if (el) el.style.opacity = val; };

  // Show X-eyes and sad mouth
  setOpacity(eyeLR as HTMLElement | null, '0');
  setOpacity(eyeRR as HTMLElement | null, '0');
  setOpacity(eyeLS as HTMLElement | null, '0');
  setOpacity(eyeRS as HTMLElement | null, '0');
  setOpacity(mouthH as HTMLElement | null, '0');
  setOpacity(mouthS as HTMLElement | null, '0');
  setOpacity(eyeLX as HTMLElement | null, '1');
  setOpacity(eyeRX as HTMLElement | null, '1');
  setOpacity(mouthSad as HTMLElement | null, '1');

  // Save original position, switch to fixed at current spot
  const rect = octoWrapEl.getBoundingClientRect();
  const origLeft = rect.left + rect.width / 2;
  const origTop = rect.top;
  // transform-origin is center bottom, so at 90° the lowest point
  // is at top + height + width/2. We want that flush with viewport bottom.
  const restTop = window.innerHeight - rect.height - rect.width / 2;
  const fallDist = restTop - rect.top;

  octoWrapEl.style.position = 'fixed';
  octoWrapEl.style.left = origLeft + 'px';
  octoWrapEl.style.top = origTop + 'px';
  octoWrapEl.style.bottom = '';
  octoWrapEl.style.margin = '0';
  octoWrapEl.style.transform = 'translateX(-50%)';
  octoWrapEl.style.transition = 'none';
  octoWrapEl.style.zIndex = '9999';

  const ph = document.querySelector('[data-octo-placeholder]') as HTMLElement | null;
  if (ph) ph.classList.remove('hidden');

  // Animate fall + bounce, then settle on side
  sadBounce(octoWrapEl, fallDist, () => {
    if (!octoWrapEl) return;

    // Pause 1s dead, then wake up
    const wakeY = fallDist - window.innerHeight * 0.01;
    setTimeout(() => {
      if (!octoWrapEl) return;

      // Wake up: lift slightly and rotate upright
      octoWrapEl.style.transition = 'transform 0.4s cubic-bezier(.34,1.56,.64,1)';
      octoWrapEl.style.transform = `translateX(-50%) translateY(${wakeY}px) rotate(0deg)`;

      // Restore face as it rights itself
      setOpacity(eyeLX as HTMLElement | null, '0');
      setOpacity(eyeRX as HTMLElement | null, '0');
      setOpacity(mouthSad as HTMLElement | null, '0');
      setOpacity(eyeLR as HTMLElement | null, '1');
      setOpacity(eyeRR as HTMLElement | null, '1');
      setOpacity(mouthH as HTMLElement | null, '1');
      setOpacity(eyeLS as HTMLElement | null, '');
      setOpacity(eyeRS as HTMLElement | null, '');
      setOpacity(mouthS as HTMLElement | null, '');
      exprMode = 'round';

      // Pause upright for 0.5s, then zip back up
      setTimeout(() => {
        if (!octoWrapEl) return;
        octoWrapEl.style.transition = 'transform 0.4s cubic-bezier(.6,0,.7,.2)';
        octoWrapEl.style.transform = `translateX(-50%) translateY(0px) rotate(0deg)`;

        // Restore to normal flow
        setTimeout(() => {
          if (!octoWrapEl) return;
          octoWrapEl.style.position = '';
          octoWrapEl.style.left = '';
          octoWrapEl.style.top = '';
          octoWrapEl.style.margin = '';
          octoWrapEl.style.transform = '';
          octoWrapEl.style.transition = '';
          octoWrapEl.style.zIndex = '';

          if (ph) ph.classList.add('hidden');
          octoAnimating = false;
        }, 450);
      }, 900);
    }, 1000);
  });
}

// ─── Idle bob ───────────────────────────────────────────────────────────────

(function bob() {
  if (!entryBusy && !octoAnimating && octoWrapEl) {
    bobT += 0.030;
    octoWrapEl.style.transform =
      `translateY(${Math.sin(bobT) * 2.5}px) rotate(${Math.sin(bobT * 0.45) * 0.8}deg)`;
  }
  requestAnimationFrame(bob);
})();

// ─── Entry animation on load ────────────────────────────────────────────────

setupOctoClick();

(document.fonts ? document.fonts.ready : Promise.resolve())
  .then(() => setTimeout(runEntry, 200))
  .catch(() => setTimeout(runEntry, 500));
