// Clumeral — modals.ts
// How-to-Play modal, toast notifications, and feedback modal.

import { todayKey } from './date.ts';

// Same-origin Worker route — inserts the submission into D1 (#213).
const FEEDBACK_URL = "/api/feedback";

// ─── Debug payload ────────────────────────────────────────────────────────────

/**
 * Reads a single localStorage key safely. Returns "" when the key is missing OR
 * when access throws (private mode, blocked, quota) — never throws, never blocks
 * the feedback send.
 */
function safeGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/**
 * Collects browser diagnostic context attached to every feedback submission.
 * Raw localStorage strings are forwarded unparsed for server-side reproduction.
 */
export function collectDebug() {
  return {
    history: safeGet("dlng_history"),
    prefs: safeGet("dlng_prefs"),
    active: safeGet("dlng_active"),
    tzOffset: new Date().getTimezoneOffset(),
    localToday: todayKey(),
    screen: `${window.innerWidth}x${window.innerHeight}`,
  };
}

// ─── Toast ──────────────────────────────────────────────────────────────────

export function showToast(message: string, duration: number = 3000): void {
  const container = document.querySelector('[data-toast]') as HTMLElement | null;
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast-msg";
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  }, duration);
}

// ─── Feedback modal ─────────────────────────────────────────────────────────

export function initFeedbackModal(
  todayUTC: () => string,
  puzzleNumber: (dateStr: string) => number,
  formatDate: (dateStr: string) => string,
): void {
  const fbModalEl = document.querySelector('[data-fb-modal]') as HTMLDialogElement | null;
  if (!fbModalEl) return;
  const modal: HTMLDialogElement = fbModalEl;

  const closeBtn = document.querySelector('[data-fb-modal-close]');
  const catBtns = modal.querySelectorAll(".fb-cat") as NodeListOf<HTMLButtonElement>;
  const msgEl = document.querySelector('[data-fb-msg]') as HTMLTextAreaElement | null;
  const counterEl = document.querySelector('[data-fb-counter]');
  const metaEl = document.querySelector('[data-fb-meta]');
  const sendBtn = document.querySelector('[data-fb-send]') as HTMLButtonElement | null;
  const footerBtn = document.querySelector('[data-fb-btn]');

  let selectedCat = "general";
  let sending = false;

  function openFeedback() {
    renderMeta();
    modal.showModal();
    requestAnimationFrame(() => modal.classList.add("open"));
  }

  function closeFeedback() {
    modal.classList.remove("open");
    modal.addEventListener("transitionend", () => {
      modal.close();
    }, { once: true });
  }

  function resetForm() {
    selectedCat = "general";
    catBtns.forEach(b => {
      const isGeneral = b.dataset.cat === "general";
      b.classList.toggle("active", isGeneral);
      b.setAttribute("aria-checked", String(isGeneral));
    });
    if (msgEl) msgEl.value = "";
    updateCounter();
    if (sendBtn) sendBtn.disabled = false;
    sending = false;
  }

  function updateCounter() {
    if (!msgEl || !counterEl) return;
    const len = msgEl.value.length;
    if (len >= 400) {
      counterEl.textContent = `${len}/500`;
      counterEl.classList.add("warn");
      counterEl.classList.remove("hidden");
    } else {
      counterEl.textContent = "";
      counterEl.classList.add("hidden");
      counterEl.classList.remove("warn");
    }
  }

  function collectMetadata() {
    const ua = navigator.userAgent;
    let browser = "Unknown";
    const chromeMatch = ua.match(/Chrome\/([\d.]+)/);
    const safariMatch = ua.match(/Version\/([\d.]+).*Safari/);
    const firefoxMatch = ua.match(/Firefox\/([\d.]+)/);
    const edgeMatch = ua.match(/Edg\/([\d.]+)/);

    if (edgeMatch) browser = `Edge ${edgeMatch[1]}`;
    else if (firefoxMatch) browser = `Firefox ${firefoxMatch[1]}`;
    else if (chromeMatch) browser = `Chrome ${chromeMatch[1]}`;
    else if (safariMatch) browser = `Safari ${safariMatch[1]}`;

    let device = "Desktop";
    if (/iPad/i.test(ua)) device = "iPad";
    else if (/iPhone/i.test(ua)) device = "iPhone";
    else if (/Android/i.test(ua)) device = /Mobi/i.test(ua) ? "Android Phone" : "Android Tablet";
    else if (/Mobi/i.test(ua)) device = "Mobile";

    const dateStr = todayUTC();
    const pNum = puzzleNumber(dateStr);

    return {
      puzzleNumber: `#${pNum}`,
      date: dateStr,
      device,
      browser,
      userAgent: ua,
    };
  }

  function renderMeta() {
    if (!metaEl) return;
    const meta = collectMetadata();
    metaEl.textContent = `Puzzle ${meta.puzzleNumber} · ${formatDate(meta.date)} · ${meta.device} · ${meta.browser} · Game data attached to help debug.`;
  }

  // Category toggle
  catBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      selectedCat = btn.dataset.cat ?? "general";
      catBtns.forEach(b => {
        const selected = b === btn;
        b.classList.toggle("active", selected);
        b.setAttribute("aria-checked", String(selected));
      });
    });
  });

  // Char counter
  if (msgEl) msgEl.addEventListener("input", updateCounter);

  // Open triggers
  if (footerBtn) footerBtn.addEventListener("click", openFeedback);

  // Close triggers
  if (closeBtn) closeBtn.addEventListener("click", closeFeedback);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeFeedback(); });
  modal.addEventListener("cancel", (e) => { e.preventDefault(); closeFeedback(); });

  // Submit with retry
  async function submitFeedback() {
    if (sending || !msgEl || !sendBtn) return;
    const message = msgEl.value.trim();
    if (!message) return;

    sending = true;
    sendBtn.disabled = true;

    const meta = collectMetadata();
    const payload = {
      category: selectedCat,
      message,
      puzzleNumber: meta.puzzleNumber,
      date: meta.date,
      device: meta.device,
      browser: meta.browser,
      userAgent: meta.userAgent,
      ...collectDebug(),
    };

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(FEEDBACK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        // Same-origin endpoint returns a real (non-opaque) response now.
        if (res.ok) {
          closeFeedback();
          setTimeout(resetForm, 300);
          showToast("Thanks! Feedback sent.");
          return;
        }
        // 4xx is a client-side problem — retrying won't help, so stop early.
        if (res.status >= 400 && res.status < 500) break;
      } catch {
        // network error — fall through to backoff + retry
      }
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    // All retries exhausted
    console.error("Feedback submission failed after retries");
    sending = false;
    if (sendBtn) sendBtn.disabled = false;
    showToast("Couldn't send feedback. Try again later.");
  }

  if (sendBtn) sendBtn.addEventListener("click", submitFeedback);

  // Init counter hidden
  updateCounter();
}
