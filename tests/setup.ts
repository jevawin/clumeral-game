import { beforeEach, vi } from 'vitest';

// Most of the suite runs in jsdom, but a few files test SERVER code and declare
// `@vitest-environment node` — tests/edit-mode-readonly.spec.ts opens real
// sockets, so it needs Node's own fetch rather than the stub below.
//
// Without this guard those files fail on `localStorage is not defined` before
// reaching their first assertion, and the fetch stub makes every real request
// return an object with no status.
const inBrowser = typeof document !== 'undefined';

beforeEach(() => {
  if (!inBrowser) return;

  localStorage.clear();
  document.title = 'Clumeral';
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
  } catch {
    /* read-only in some envs — ignore */
  }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) }) as unknown as Response));
});
