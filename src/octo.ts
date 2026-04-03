// Clumeral — octo.ts
// Octopus mascot animations: eye tracking, blink/wink, squint-glance,
// spring bounce, letter reveal, celebrate, sad, idle bob.

// ─── DOM references ─────────────────────────────────────────────────────────

const octoEl     = document.getElementById('octo');
const octoWrapEl = document.getElementById('octo-wrap');
const tlts       = [...document.querySelectorAll('.tlt')] as HTMLElement[];

// ── Eye / mouth elements ──
const eyeLR   = document.getElementById('eyeL-r');
const eyeRR   = document.getElementById('eyeR-r');
const eyeLS   = document.getElementById('eyeL-s');
const eyeRS   = document.getElementById('eyeR-s');
const eyeLX   = document.getElementById('eyeL-x');
const eyeRX   = document.getElementById('eyeR-x');
const mouthH  = document.getElementById('mouth-h');
const mouthS  = document.getElementById('mouth-s');
const mouthSad = document.getElementById('mouth-sad');

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
    const r  = octoEl.getBoundingClientRect();
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    eyeTX = cl((e.clientX - (r.left + r.width  / 2)) / 55, -1.8,  1.8);
    eyeTY = cl((e.clientY - (r.top  + r.height / 2)) / 55, -1.5,  1.5);
  }
});

(function trackEyes() {
  eyeX += (eyeTX - eyeX) * 0.12;
  eyeY += (eyeTY - eyeY) * 0.12;
  eyeLR.setAttribute('cx', String(19 + eyeX)); eyeLR.setAttribute('cy', String(15 + eyeY));
  eyeRR.setAttribute('cx', String(33 + eyeX)); eyeRR.setAttribute('cy', String(15 + eyeY));
  eyeLS.setAttribute('transform', `translate(${eyeX},${eyeY})`);
  eyeRS.setAttribute('transform', `translate(${eyeX},${eyeY})`);
  requestAnimationFrame(trackEyes);
})();

// ─── Blink / wink ───────────────────────────────────────────────────────────

function winkEye(eye, cb) {
  const dur = 140, s = performance.now();
  (function f(now) {
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

function fadeExpr(toSquint, dur, onDone) {
  const s = performance.now();
  (function f(now) {
    const t = Math.min((now - s) / dur, 1);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const ra = toSquint ? 1 - e : e;
    const sa = toSquint ? e : 1 - e;
    [eyeLR, eyeRR].forEach((el) => el.setAttribute('opacity', String(ra)));
    [eyeLS, eyeRS].forEach((el) => el.setAttribute('opacity', String(sa)));
    mouthH.setAttribute('opacity', String(ra));
    mouthS.setAttribute('opacity', String(sa));
    if (t < 1) requestAnimationFrame(f);
    else {
      [eyeLR, eyeRR].forEach((el) => el.setAttribute('opacity', toSquint ? '0' : '1'));
      [eyeLS, eyeRS].forEach((el) => el.setAttribute('opacity', toSquint ? '1' : '0'));
      mouthH.setAttribute('opacity', toSquint ? '0' : '1');
      mouthS.setAttribute('opacity', toSquint ? '1' : '0');
      if (onDone) onDone();
    }
  })(performance.now());
}

function doSquint() {
  if (squintBusy || exprMode !== 'round') return;
  squintBusy = true; exprMode = 'transitioning';
  eyeLR.setAttribute('r', '3'); eyeRR.setAttribute('r', '3');
  fadeExpr(true, 260, () => {
    exprMode = 'squint-glancing';
    const glances = [{ tx: -1.5, ty: -0.6 }, { tx: 1.4, ty: -0.4 }, { tx: 0.3, ty: 0.9 }, { tx: 0, ty: 0 }];
    let gi = 0;
    function glance() {
      if (gi >= glances.length) {
        exprMode = 'transitioning';
        eyeLS.removeAttribute('transform'); eyeRS.removeAttribute('transform');
        fadeExpr(false, 260, () => { exprMode = 'round'; squintBusy = false; scheduleSquint(); });
        return;
      }
      const g = glances[gi++];
      const dur = 460 + Math.random() * 360;
      const s = performance.now(), fx = eyeTX, fy = eyeTY;
      (function mv(now) {
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

function springBounce(cb) {
  const H = 56, dur = 660, s = performance.now();
  (function f(now) {
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
    octoWrapEl.style.transform = `translateY(${y}px) scaleX(${sx}) scaleY(${sy})`;
    if (r < 1) requestAnimationFrame(f);
    else { octoWrapEl.style.transform = ''; if (cb) cb(); }
  })(performance.now());
}

// ─── Letter reveal ──────────────────────────────────────────────────────────

function resetOcto() {
  octoWrapEl.style.transition = 'none';
  octoWrapEl.style.opacity    = '0';
  octoWrapEl.style.transform  = 'translateY(-0.75rem)';
}

function revealOcto(onDone) {
  void octoWrapEl.offsetWidth;
  octoWrapEl.style.transition = 'opacity 0.2s ease-out, transform 0.4s cubic-bezier(.34,1.56,.64,1)';
  octoWrapEl.style.opacity    = '1';
  octoWrapEl.style.transform  = 'translateY(0)';
  setTimeout(() => {
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

function revealLetters(onDone) {
  tlts.forEach((l, i) => setTimeout(() => {
    l.style.transition = 'opacity .15s ease-out, transform .22s cubic-bezier(.34,1.56,.64,1)';
    l.style.opacity    = '1';
    l.style.transform  = 'translateY(0)';
    if (i === tlts.length - 1) setTimeout(onDone, 120);
  }, i * 80));
}

function watchLetters(dur) {
  const s = performance.now();
  (function f(now) {
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
  octoWrapEl.addEventListener('click', () => { if (!entryBusy && !octoAnimating) runEntry(); });
}

export function celebrateOcto(): void {
  if (octoAnimating) return;
  octoAnimating = true;

  const rect = octoWrapEl.getBoundingClientRect();
  const origLeft = rect.left;
  const origTop = rect.top;

  octoWrapEl.style.position = 'fixed';
  octoWrapEl.style.left = '50%';
  octoWrapEl.style.top = '50%';
  octoWrapEl.style.margin = '0';

  const ph = document.getElementById('octo-placeholder');
  if (ph) ph.classList.remove('hidden');

  octoEl.classList.add('celebrate');
  octoWrapEl.classList.add('celebrating');
  document.body.style.overflow = 'hidden';

  // After fly animation ends, transition back to header
  setTimeout(() => {
    octoWrapEl.style.transform = 'translate(-50%, -50%)';
    octoWrapEl.classList.remove('celebrating');
    octoEl.classList.remove('celebrate');

    requestAnimationFrame(() => {
      octoWrapEl.style.transition = 'left 0.6s ease-in-out, top 0.6s ease-in-out, transform 0.6s ease-in-out';
      octoWrapEl.style.left = origLeft + 'px';
      octoWrapEl.style.top = origTop + 'px';
      octoWrapEl.style.transform = '';

      setTimeout(() => {
        octoWrapEl.style.position = '';
        octoWrapEl.style.left = '';
        octoWrapEl.style.top = '';
        octoWrapEl.style.margin = '';
        octoWrapEl.style.transition = '';
        octoWrapEl.style.opacity = '1';

        const ph = document.getElementById('octo-placeholder');
        if (ph) ph.classList.add('hidden');

        const digitsEl = document.getElementById('cw-digits');
        if (digitsEl) digitsEl.classList.add('hidden');

        document.body.style.overflow = '';
        exprMode = 'round';
        octoAnimating = false;
      }, 650);
    });
  }, 5100);
}

export function sadOcto(): void {
  if (octoAnimating) return;
  octoAnimating = true;
  exprMode = 'sad';

  // Show X-eyes and sad mouth
  eyeLR.style.opacity = '0';
  eyeRR.style.opacity = '0';
  eyeLS.style.opacity = '0';
  eyeRS.style.opacity = '0';
  mouthH.style.opacity = '0';
  mouthS.style.opacity = '0';
  eyeLX.style.opacity = '1';
  eyeRX.style.opacity = '1';
  mouthSad.style.opacity = '1';

  // Tilt sideways
  octoWrapEl.style.transition = 'transform 0.3s ease-out';
  octoWrapEl.style.transform = 'rotate(-80deg) translateY(20px)';

  setTimeout(() => {
    // Spring back
    octoWrapEl.style.transition = 'transform 0.45s cubic-bezier(.34,1.56,.64,1)';
    octoWrapEl.style.transform = '';

    setTimeout(() => {
      // Restore face
      octoWrapEl.style.transition = '';
      eyeLR.style.opacity = '1';
      eyeRR.style.opacity = '1';
      eyeLS.style.opacity = '';
      eyeRS.style.opacity = '';
      mouthH.style.opacity = '1';
      mouthS.style.opacity = '';
      eyeLX.style.opacity = '0';
      eyeRX.style.opacity = '0';
      mouthSad.style.opacity = '0';
      exprMode = 'round';
      octoAnimating = false;
    }, 450);
  }, 1800);
}

// ─── Idle bob ───────────────────────────────────────────────────────────────

(function bob() {
  if (!entryBusy && !octoAnimating) {
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
