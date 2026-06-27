import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  document.title = 'Clumeral';
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
  } catch {
    /* read-only in some envs — ignore */
  }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) }) as unknown as Response));
});
