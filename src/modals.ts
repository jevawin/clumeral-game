// Clumeral — modals.ts
// How-to-Play modal, toast notifications, and feedback modal.

import { loadHistory } from './storage.ts';

const FEEDBACK_URL = "https://script.google.com/macros/s/AKfycbxSnk8QFvjnh9Bmk0kv6I7xacnvDvcw_lgM_gBF6TzvPtqNvAlnxM7UJi-sjMku8bSQKw/exec";

// ─── How-to-Play modal ──────────────────────────────────────────────────────

export function initModal(): (() => void) | null {
  const modalEl = document.querySelector('[data-modal]') as HTMLDialogElement | null;
  if (!modalEl) return null;
  const modal: HTMLDialogElement = modalEl;
  const htpBtn = document.querySelector('[data-htp-btn]') as HTMLElement | null;

  function openModal() {
    localStorage.setItem("cw-htp-seen", "1");
    modal.showModal();
    requestAnimationFrame(() => modal.classList.add("open"));
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.addEventListener("transitionend", () => {
      modal.close();
      if (htpBtn) htpBtn.focus();
    }, { once: true });
  }

  const closeBtn = document.querySelector('[data-modal-close]');
  const gotitBtn = document.querySelector('[data-modal-gotit]');
  if (htpBtn) htpBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (gotitBtn) gotitBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  modal.addEventListener("cancel", (e) => { e.preventDefault(); closeModal(); });

  return openModal;
}

export function maybeAutoShowModal(openModal: (() => void) | null): void {
  if (localStorage.getItem("cw-htp-seen")) return;
  if (loadHistory().length > 0) return;
  if (!openModal) return;
  setTimeout(openModal, 400);
}

// ─── Toast ──────────────────────────────────────────────────────────────────

export function showToast(message: string, duration: number = 3000): void {
  const container = document.querySelector('[data-toast]') as HTMLElement | null;
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast__msg";
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
  todayLocal: () => string,
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
  const headerBtn = document.querySelector('[data-fb-header-btn]');
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

    const dateStr = todayLocal();
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
    metaEl.textContent = `Puzzle ${meta.puzzleNumber} · ${formatDate(meta.date)} · ${meta.device} · ${meta.browser}`;
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
  if (headerBtn) headerBtn.addEventListener("click", openFeedback);
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
    };

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(FEEDBACK_URL, {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify(payload),
        });
        // no-cors returns opaque response; if no error thrown, it succeeded
        if (res.ok || res.type === "opaque") {
          closeFeedback();
          setTimeout(resetForm, 300);
          showToast("Thanks! Feedback sent.");
          return;
        }
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
      }
    }

    // All retries exhausted
    console.error("Feedback submission failed after retries", payload);
    sending = false;
    if (sendBtn) sendBtn.disabled = false;
    showToast("Couldn't send feedback. Try again later.");
  }

  if (sendBtn) sendBtn.addEventListener("click", submitFeedback);

  // Init counter hidden
  updateCounter();
}
