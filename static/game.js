// Canvas dot-grid needs these per-theme values (everything else is CSS vars)
const CANVAS = {
  light: { dot: '38,38,36',   db: 0.10, dbo: 0.38 },
  dark:  { dot: '255,253,247', db: 0.11, dbo: 0.40 },
};

const _storedTheme = localStorage.getItem('dlng_theme');
let isDark = _storedTheme !== null ? _storedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
let C = CANVAS.light;

// ── Dot grid ──────────────────────────────────
const canvas = document.getElementById('cw-canvas');
const ctx    = canvas.getContext('2d');
let mouse    = { x: -999, y: -999 };

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = document.body.scrollHeight;
  drawDots();
}

function drawDots() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  for (let x = 24; x < W; x += 24) {
    for (let y = 24; y < H; y += 24) {
      const d = Math.sqrt((x - mouse.x) ** 2 + (y - mouse.y) ** 2);
      const a = C.db + (d < 90 ? (C.dbo - C.db) * ((1 - d / 90) ** 2) : 0);
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${C.dot},${a.toFixed(3)})`;
      ctx.fill();
    }
  }
}

document.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY + window.scrollY;
  drawDots();
});
document.addEventListener('mouseleave', () => { mouse = { x: -999, y: -999 }; drawDots(); });
window.addEventListener('resize', resizeCanvas);

// ── Theme ─────────────────────────────────────
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
function applyTheme() {
  C = isDark ? CANVAS.dark : CANVAS.light;
  document.documentElement.classList.toggle('dark',  isDark);
  document.documentElement.classList.toggle('light', !isDark);
  document.getElementById('cw-tog').textContent = isDark ? 'Light' : 'Dark';
  if (themeColorMeta) themeColorMeta.content = isDark ? '#262624' : '#f5edd8';
  drawDots();
}

function toggleMode() { isDark = !isDark; localStorage.setItem('dlng_theme', isDark ? 'dark' : 'light'); applyTheme(); }

// ── Puzzle state ──────────────────────────────
const possibles = [
  new Set(['1','2','3','4','5','6','7','8','9']),
  new Set(['0','1','2','3','4','5','6','7','8','9']),
  new Set(['0','1','2','3','4','5','6','7','8','9']),
];
let activeBox = null;
let gameSolved = false;

const digitBoxEls = [0,1,2].map(i => document.getElementById(`d${i}`));
digitBoxEls.forEach((el, i) => el.addEventListener('click', () => selectBox(i)));
const keypadWrap  = document.getElementById('cw-keypad-wrap');
const keypadEl    = document.getElementById('cw-keypad');
const hintEl      = document.getElementById('cw-hint');
const submitWrap  = document.getElementById('cw-submit-wrap');

function remaining(i) {
  return [...possibles[i]].sort((a,b) => +a - +b);
}

function renderBox(i) {
  const box = digitBoxEls[i];
  const rem = remaining(i);

  box.classList.toggle('active', activeBox === i);
  box.innerHTML = '';

  if (rem.length === 1) {
    const big = document.createElement('span');
    big.className = 'db-resolved';
    big.textContent = rem[0];
    box.appendChild(big);
    return;
  }

  const wrap = document.createElement('div');

  if (i === 0) {
    wrap.className = 'db-possibles';
    ['1','2','3','4','5','6','7','8','9'].forEach(n => {
      const sp = document.createElement('span');
      sp.textContent = n;
      if (!possibles[i].has(n)) sp.classList.add('elim');
      wrap.appendChild(sp);
    });
  } else {
    wrap.className = 'db-possibles four-col';
    ['0','1','2','3'].forEach(n => {
      const sp = document.createElement('span');
      sp.textContent = n;
      if (!possibles[i].has(n)) sp.classList.add('elim');
      wrap.appendChild(sp);
    });
    [['4','5','6'],['7','8','9']].forEach(([a,mid,b]) => {
      const sa = document.createElement('span');
      sa.textContent = a;
      if (!possibles[i].has(a)) sa.classList.add('elim');
      wrap.appendChild(sa);

      const sm = document.createElement('span');
      sm.className = 'dc-mid';
      sm.textContent = mid;
      if (!possibles[i].has(mid)) sm.classList.add('elim');
      wrap.appendChild(sm);

      const sb = document.createElement('span');
      sb.textContent = b;
      if (!possibles[i].has(b)) sb.classList.add('elim');
      wrap.appendChild(sb);
    });
  }

  box.appendChild(wrap);
}

function renderAllBoxes() { [0,1,2].forEach(i => renderBox(i)); }

function buildKeypad() {
  keypadEl.innerHTML = '';
  if (activeBox === null) return;
  const nums = activeBox === 0
    ? ['1','2','3','4','5','6','7','8','9']
    : ['0','1','2','3','4','5','6','7','8','9'];
  nums.forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'kbtn' + (possibles[activeBox].has(n) ? '' : ' elim');
    btn.textContent = n;
    btn.addEventListener('click', () => toggleElim(n));
    keypadEl.appendChild(btn);
  });
}

function toggleElim(n) {
  if (activeBox === null) return;
  const s = possibles[activeBox];
  if (s.has(n) && s.size === 1) return;
  if (s.has(n)) s.delete(n); else s.add(n);
  renderBox(activeBox);
  buildKeypad();
  checkSubmit();
}

function selectBox(i) {
  if (gameSolved) return;
  if (activeBox === i) { closeKeypad(); return; }
  activeBox = i;
  renderAllBoxes();
  buildKeypad();
  keypadWrap.classList.add('open');
  hintEl.textContent = 'Tap numbers to remove them as possibles.';
}

function closeKeypad() {
  activeBox = null;
  renderAllBoxes();
  keypadWrap.classList.remove('open');
  hintEl.textContent = 'Tap a box to eliminate possible numbers.';
}

function checkSubmit() {
  submitWrap.classList.toggle('visible', [0,1,2].every(i => possibles[i].size === 1));
}

const CORRECT_ANSWER = '250';

function submitAnswer() {
  const answer = [0,1,2].map(i => [...possibles[i]][0]).join('');
  if (answer === CORRECT_ANSWER) triggerCorrect();
  else triggerWrong(answer);
}

// ── Wrong answer ──────────────────────────────
const eyeLX    = document.getElementById('eyeL-x');
const eyeRX    = document.getElementById('eyeR-x');
const mouthSad = document.getElementById('mouth-sad');
let wrongBusy = false;

function triggerWrong(answer) {
  if (wrongBusy) return;
  wrongBusy = true;

  hintEl.textContent = `${answer} isn't right — keep trying!`;
  hintEl.style.color = '#ff6d5a';

  [eyeLR, eyeRR].forEach(el => el.setAttribute('opacity', '0'));
  [eyeLS, eyeRS].forEach(el => el.setAttribute('opacity', '0'));
  mouthH.setAttribute('opacity', '0');
  mouthS.setAttribute('opacity', '0');
  mouthSad.setAttribute('opacity', '1');
  eyeLX.setAttribute('opacity', '1');
  eyeRX.setAttribute('opacity', '1');

  const dur = 500, pauseMs = 1800, recoverDur = 400;
  const s = performance.now();
  entryBusy = true;

  const octoRect = octoWrap.getBoundingClientRect();
  const fallDir = (octoRect.left + octoRect.width / 2) > window.innerWidth / 2 ? -1 : 1;

  (function fall(now) {
    const t = Math.min((now - s) / dur, 1);
    const e = 1 - Math.pow(1 - t, 3);
    octoWrap.style.transform = `rotate(${e * 90 * fallDir}deg) translateX(${e * 8 * fallDir}px)`;
    if (t < 1) { requestAnimationFrame(fall); return; }

    setTimeout(() => {
      const rs = performance.now();
      (function recover(now2) {
        const t2 = Math.min((now2 - rs) / recoverDur, 1);
        const e2 = 1 - Math.pow(1 - t2, 3);
        octoWrap.style.transform = `rotate(${(1 - e2) * 90 * fallDir}deg) translateX(${(1 - e2) * 8 * fallDir}px)`;
        if (t2 < 1) { requestAnimationFrame(recover); return; }

        octoWrap.style.transform = '';
        entryBusy = false;
        [eyeLR, eyeRR].forEach(el => el.setAttribute('opacity', '1'));
        eyeLX.setAttribute('opacity', '0');
        eyeRX.setAttribute('opacity', '0');
        mouthH.setAttribute('opacity', '1');
        mouthSad.setAttribute('opacity', '0');
        hintEl.textContent = 'Tap a box to eliminate possible numbers.';
        hintEl.style.color = '';
        wrongBusy = false;
      })(performance.now());
    }, pauseMs);
  })(performance.now());
}

// ── Correct answer ────────────────────────────
function triggerCorrect() {
  hintEl.textContent = `${CORRECT_ANSWER} is the correct answer!`;
  hintEl.style.color = '#4caf88';
  hintEl.style.fontWeight = '700';

  digitBoxEls.forEach(b => {
    b.style.border     = '1.5px solid #4caf88';
    b.style.background = 'rgba(76,175,136,.12)';
  });

  gameSolved = true;
  closeKeypad();
  submitWrap.classList.remove('visible');
  startConfetti();
  if (!isFloating) detachOcto();
  octo.classList.add('celebrate');
  flyOcto(5000, () => {
    const ph = document.getElementById('octo-placeholder').getBoundingClientRect();
    animateTo(ph.left, ph.top, 900, () => {
      reattachOcto();
    });
    setTimeout(() => octo.classList.remove('celebrate'), 900);
  });
}

// ── Confetti ──────────────────────────────────
let confettiCanvas, confettiCtx, confettiPieces = [], confettiRaf;

function startConfetti() {
  if (confettiCanvas) confettiCanvas.remove();
  confettiCanvas = document.createElement('canvas');
  confettiCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:499;';
  confettiCanvas.width  = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  document.body.appendChild(confettiCanvas);
  confettiCtx = confettiCanvas.getContext('2d');
  confettiPieces = [];

  const colours = ['#ff6d5a','#f7f2e8','#4caf88','#f4c842','#7b68ee','#ff9f7f'];
  for (let i = 0; i < 160; i++) {
    confettiPieces.push({
      x: Math.random() * window.innerWidth,
      y: -10 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.2,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 4,
      colour: colours[Math.floor(Math.random() * colours.length)],
      wobble: Math.random() * Math.PI * 2,
      wobbleSpd: 0.05 + Math.random() * 0.05,
    });
  }

  const end = performance.now() + 5500;
  (function drawConfetti(now) {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiPieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vrot; p.wobble += p.wobbleSpd;
      p.vx += (Math.random() - 0.5) * 0.1;
      confettiCtx.save();
      confettiCtx.translate(p.x + Math.sin(p.wobble) * 4, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.colour;
      confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      confettiCtx.restore();
    });
    confettiPieces = confettiPieces.filter(p => p.y < confettiCanvas.height + 20);
    if (now < end || confettiPieces.length > 0) {
      confettiRaf = requestAnimationFrame(drawConfetti);
    } else {
      confettiCanvas.remove();
      confettiCanvas = null;
    }
  })(performance.now());
}

// ── Modal ─────────────────────────────────────
const modal = document.getElementById('cw-modal');

function openModal()  { modal.style.display='flex'; requestAnimationFrame(() => modal.classList.add('open')); }
function closeModal() { modal.classList.remove('open'); modal.addEventListener('transitionend', () => { modal.style.display='none'; }, {once:true}); localStorage.setItem('cw-htp-seen', '1'); }
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

// ── Octo expressions ──────────────────────────
const eyeLR  = document.getElementById('eyeL-r');
const eyeRR  = document.getElementById('eyeR-r');
const eyeLS  = document.getElementById('eyeL-s');
const eyeRS  = document.getElementById('eyeR-s');
const mouthH = document.getElementById('mouth-h');
const mouthS = document.getElementById('mouth-s');
const octo   = document.getElementById('octo');
let exprMode = 'round';
let eyeTX = 0, eyeTY = 0, eyeX = 0, eyeY = 0;

document.addEventListener('mousemove', e => {
  if (exprMode !== 'squint-glancing') {
    const r  = octo.getBoundingClientRect();
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    eyeTX = cl((e.clientX - (r.left + r.width  / 2)) / 55, -1.8,  1.8);
    eyeTY = cl((e.clientY - (r.top  + r.height / 2)) / 55, -1.5,  1.5);
  }
});

(function trackEyes() {
  eyeX += (eyeTX - eyeX) * 0.12;
  eyeY += (eyeTY - eyeY) * 0.12;
  eyeLR.setAttribute('cx', 19 + eyeX); eyeLR.setAttribute('cy', 15 + eyeY);
  eyeRR.setAttribute('cx', 33 + eyeX); eyeRR.setAttribute('cy', 15 + eyeY);
  eyeLS.setAttribute('transform', `translate(${eyeX},${eyeY})`);
  eyeRS.setAttribute('transform', `translate(${eyeX},${eyeY})`);
  requestAnimationFrame(trackEyes);
})();

let winkLeft = true;
function winkEye(eye, cb) {
  const dur = 140, s = performance.now();
  (function f(now) {
    const t = Math.min((now - s) / dur, 1);
    eye.setAttribute('r', Math.max(0.1, 3 * Math.abs(Math.cos(t * Math.PI))));
    if (t < 1) requestAnimationFrame(f);
    else { eye.setAttribute('r', 3); if (cb) cb(); }
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

function fadeExpr(toSquint, dur, onDone) {
  const s = performance.now();
  (function f(now) {
    const t = Math.min((now - s) / dur, 1);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const ra = toSquint ? 1 - e : e;
    const sa = toSquint ? e : 1 - e;
    [eyeLR, eyeRR].forEach(el => el.setAttribute('opacity', ra));
    [eyeLS, eyeRS].forEach(el => el.setAttribute('opacity', sa));
    mouthH.setAttribute('opacity', ra);
    mouthS.setAttribute('opacity', sa);
    if (t < 1) requestAnimationFrame(f);
    else {
      [eyeLR, eyeRR].forEach(el => el.setAttribute('opacity', toSquint ? '0' : '1'));
      [eyeLS, eyeRS].forEach(el => el.setAttribute('opacity', toSquint ? '1' : '0'));
      mouthH.setAttribute('opacity', toSquint ? '0' : '1');
      mouthS.setAttribute('opacity', toSquint ? '1' : '0');
      if (onDone) onDone();
    }
  })(performance.now());
}

let squintBusy = false;
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

// ── Spring bounce ─────────────────────────────
const octoWrap = document.getElementById('octo-wrap');
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
    octoWrap.style.transform = `translateY(${y}px) scaleX(${sx}) scaleY(${sy})`;
    if (r < 1) requestAnimationFrame(f);
    else { octoWrap.style.transform = ''; if (cb) cb(); }
  })(performance.now());
}

// ── Letter reveal ─────────────────────────────
const tlts = [...document.querySelectorAll('.tlt')];
let entryBusy = false, bobT = 0;

function resetOcto() {
  octoWrap.style.transition = 'none';
  octoWrap.style.opacity    = '0';
  octoWrap.style.transform  = 'translateY(-0.75rem)';
}

function revealOcto(onDone) {
  void octoWrap.offsetWidth;
  octoWrap.style.transition = 'opacity 0.2s ease-out, transform 0.4s cubic-bezier(.34,1.56,.64,1)';
  octoWrap.style.opacity    = '1';
  octoWrap.style.transform  = 'translateY(0)';
  setTimeout(() => {
    octoWrap.style.transition = '';
    octoWrap.style.transform  = '';
    if (onDone) onDone();
  }, 420);
}

function resetLetters() {
  tlts.forEach(l => {
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
    if (el && octo) {
      const lr = el.getBoundingClientRect();
      const or = octo.getBoundingClientRect();
      if (lr.width > 0 && or.width > 0) {
        eyeTX = Math.max(-1.8, Math.min(1.8, (lr.left + lr.width  / 2 - (or.left + or.width  / 2)) / 40));
        eyeTY = Math.max(-1.5, Math.min(1.5, (lr.top  + lr.height / 2 - (or.top  + or.height / 2)) / 40));
      }
    }
    if (t < 1) requestAnimationFrame(f);
  })(performance.now());
}

function runEntry() {
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

function replayEntry() { if (!entryBusy) runEntry(); }

// ── Floating octopus ──────────────────────────
const OCTO_SIZE = 52;
let isFloating = false;
let floatX = 0, floatY = 0;
let isDragging = false, dragOX = 0, dragOY = 0;
let animateId = 0;
let gentleFloatActive = false;

function octoHomePos() {
  const r = document.getElementById('cw-card').getBoundingClientRect();
  return { x: r.right - OCTO_SIZE - 8, y: r.top + 8 };
}
function octoHomeX() { return octoHomePos().x; }
function octoHomeY() { return octoHomePos().y; }
function clampX(x)   { return Math.max(0, Math.min(window.innerWidth  - OCTO_SIZE, x)); }
function clampY(y)   { return Math.max(0, Math.min(window.innerHeight - OCTO_SIZE, y)); }

function detachOcto() {
  if (isFloating) return;
  isFloating = true;
  const r = octoWrap.getBoundingClientRect();
  floatX = r.left; floatY = r.top;
  octoWrap.classList.add('floating');
  octoWrap.style.left = floatX + 'px';
  octoWrap.style.top  = floatY + 'px';
  octoWrap.style.transform = '';
  document.getElementById('octo-placeholder').style.display = 'block';
  gentleFloatActive = true;
  animateTo(octoHomeX(), octoHomeY(), 900, () => setTimeout(gentleFloat, 300));
}

function reattachOcto() {
  if (!isFloating) return;
  isFloating = false; isDragging = false;
  gentleFloatActive = false;
  octoWrap.classList.remove('floating');
  octoWrap.style.left = octoWrap.style.top = '';
  octoWrap.style.transform = '';
  document.getElementById('octo-placeholder').style.display = 'none';
}

function animateTo(tx, ty, dur, onDone) {
  const id = ++animateId;
  const sx = floatX, sy = floatY, s = performance.now();
  (function f(now) {
    if (id !== animateId || !isFloating || isDragging) return;
    const p = Math.min((now - s) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    floatX = sx + (tx - sx) * e;
    floatY = sy + (ty - sy) * e;
    octoWrap.style.left = floatX + 'px';
    octoWrap.style.top  = floatY + 'px';
    if (p < 1) requestAnimationFrame(f);
    else if (onDone) onDone();
  })(performance.now());
}

function gentleFloat() {
  if (!isFloating || !gentleFloatActive || isDragging) return;
  const tx = clampX(floatX + (Math.random() - 0.5) * 80);
  const ty = clampY(floatY + (Math.random() - 0.5) * 60);
  const dx = tx - floatX, dy = ty - floatY;
  const dur = Math.max(1800, Math.sqrt(dx * dx + dy * dy) * 5);
  animateTo(tx, ty, dur, () => setTimeout(gentleFloat, 300 + Math.random() * 400));
}

function flyOcto(duration, onDone) {
  gentleFloatActive = false;
  const end = performance.now() + duration;
  const pad = OCTO_SIZE + 20;
  function nextMove() {
    if (!isFloating) return;
    if (performance.now() >= end) { if (onDone) onDone(); return; }
    const tx = pad + Math.random() * (window.innerWidth  - pad * 2);
    const ty = pad + Math.random() * (window.innerHeight - pad * 2);
    const dx = tx - floatX, dy = ty - floatY;
    const dur = Math.max(250, Math.sqrt(dx * dx + dy * dy) * 0.55);
    animateTo(tx, ty, dur);
    setTimeout(nextMove, dur + 40);
  }
  nextMove();
}

octoWrap.addEventListener('mousedown', e => {
  if (!isFloating) return;
  isDragging = true;
  dragOX = e.clientX - floatX; dragOY = e.clientY - floatY;
  fadeExpr(true, 200, () => {});
  e.preventDefault();
});
octoWrap.addEventListener('touchstart', e => {
  if (!isFloating) return;
  isDragging = true;
  const t = e.touches[0];
  dragOX = t.clientX - floatX; dragOY = t.clientY - floatY;
  fadeExpr(true, 200, () => {});
  e.preventDefault();
}, { passive: false });

document.addEventListener('mousemove', e => {
  if (!isDragging) return;
  floatX = clampX(e.clientX - dragOX); floatY = clampY(e.clientY - dragOY);
  octoWrap.style.left = floatX + 'px'; octoWrap.style.top = floatY + 'px';
});
document.addEventListener('touchmove', e => {
  if (!isDragging) return;
  const t = e.touches[0];
  floatX = clampX(t.clientX - dragOX); floatY = clampY(t.clientY - dragOY);
  octoWrap.style.left = floatX + 'px'; octoWrap.style.top = floatY + 'px';
  e.preventDefault();
}, { passive: false });

function stopDrag() {
  if (!isDragging) return;
  isDragging = false;
  if (exprMode !== 'round') fadeExpr(false, 260, () => { exprMode = 'round'; squintBusy = false; });
  if (gentleFloatActive) setTimeout(gentleFloat, 600);
}
document.addEventListener('mouseup',  stopDrag);
document.addEventListener('touchend', stopDrag);

window.addEventListener('scroll', () => {
  if (isFloating && !isDragging) {
    if (document.getElementById('octo-placeholder').getBoundingClientRect().top > 20) reattachOcto();
  }
}, { passive: true });

// ── Idle bob ──────────────────────────────────
(function bob() {
  if (!entryBusy && !isFloating) {
    bobT += 0.030;
    octoWrap.style.transform =
      `translateY(${Math.sin(bobT) * 2.5}px) rotate(${Math.sin(bobT * 0.45) * 0.8}deg)`;
  }
  requestAnimationFrame(bob);
})();

// ── Footer heart ──────────────────────────────
const footHeart = document.getElementById('footer-heart');
function triggerHeartBounce() {
  footHeart.classList.remove('bouncing');
  void footHeart.offsetWidth;
  footHeart.classList.add('bouncing');
}
footHeart.addEventListener('animationend', () => footHeart.classList.remove('bouncing'));
setInterval(triggerHeartBounce, 3000);
triggerHeartBounce();

// ── Init ──────────────────────────────────────
applyTheme();
renderAllBoxes();
resizeCanvas();
if (!localStorage.getItem('cw-htp-seen')) setTimeout(openModal, 400);
(document.fonts ? document.fonts.ready : Promise.resolve())
  .then(() => setTimeout(runEntry, 200))
  .catch(() => setTimeout(runEntry, 500));
