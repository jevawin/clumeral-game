import { describe, it, expect } from 'vitest';
import {
  parseStatusPath,
  isSameOrigin,
  isStatus,
  statusOf,
  renderFeedbackPage,
  type FeedbackRow,
} from '../src/worker/feedback.ts';

// Triage state for feedback rows (#225). The status-update route is the only
// authenticated write path in the Worker, so its guards are tested directly.

function row(over: Partial<FeedbackRow> = {}): FeedbackRow {
  return {
    id: 1, created_at: '2026-07-01 10:00:00', category: 'bug', message: 'it broke',
    puzzle_number: '#100', puzzle_date: '2026-07-01', device: 'iPhone', browser: 'Safari 26',
    user_agent: null, history: null, prefs: null, active: null, tz_offset: 0,
    local_today: '2026-07-01', screen: '390x844', host: 'clumeral.com',
    status: 'open', github_issue: null, resolved_at: null,
    ...over,
  };
}

describe('parseStatusPath', () => {
  it('extracts the row id from the status path', () => {
    expect(parseStatusPath('/feedback/12/status')).toBe(12);
    expect(parseStatusPath('/feedback/1/status')).toBe(1);
  });

  it('rejects anything that is not exactly the status path', () => {
    expect(parseStatusPath('/feedback')).toBeNull();
    expect(parseStatusPath('/feedback/12')).toBeNull();
    expect(parseStatusPath('/feedback/12/status/extra')).toBeNull();
    expect(parseStatusPath('/api/feedback/12/status')).toBeNull();
    expect(parseStatusPath('/feedback/abc/status')).toBeNull();
    expect(parseStatusPath('/feedback/-1/status')).toBeNull();
    expect(parseStatusPath('/feedback/1.5/status')).toBeNull();
  });

  it('rejects id 0 and ids too large to represent exactly', () => {
    expect(parseStatusPath('/feedback/0/status')).toBeNull();
    expect(parseStatusPath('/feedback/99999999999999999999/status')).toBeNull();
  });
});

describe('isSameOrigin — CSRF guard', () => {
  const origin = 'https://clumeral.com';

  it('accepts an exact origin match', () => {
    expect(isSameOrigin('https://clumeral.com', origin)).toBe(true);
  });

  it('rejects a missing Origin header', () => {
    // Reject rather than allow: this route is only ever reached from our own form,
    // so there is no legitimate origin-less caller.
    expect(isSameOrigin(null, origin)).toBe(false);
    expect(isSameOrigin('', origin)).toBe(false);
  });

  it('rejects cross-origin and lookalike origins', () => {
    expect(isSameOrigin('https://evil.com', origin)).toBe(false);
    expect(isSameOrigin('http://clumeral.com', origin)).toBe(false);
    expect(isSameOrigin('https://clumeral.com.evil.com', origin)).toBe(false);
    expect(isSameOrigin('https://clumeral.com/', origin)).toBe(false);
  });
});

describe('isStatus', () => {
  it('accepts only open and resolved', () => {
    expect(isStatus('open')).toBe(true);
    expect(isStatus('resolved')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isStatus('wontfix')).toBe(false);
    expect(isStatus('OPEN')).toBe(false);
    expect(isStatus('')).toBe(false);
    expect(isStatus(null)).toBe(false);
    expect(isStatus(1)).toBe(false);
  });
});

describe('statusOf — pre-#225 rows', () => {
  it('treats a NULL status as open', () => {
    // Rows written before the migration were never triaged, which is what open means.
    expect(statusOf(row({ status: null }))).toBe('open');
  });

  it('treats an unrecognised status as open rather than hiding the row', () => {
    expect(statusOf(row({ status: 'garbage' }))).toBe('open');
  });

  it('reads resolved', () => {
    expect(statusOf(row({ status: 'resolved' }))).toBe('resolved');
  });
});

describe('renderFeedbackPage — triage controls', () => {
  it('renders a resolve form pointing at the row id', () => {
    const html = renderFeedbackPage([row({ id: 7 })], 'clumeral.com', false);
    expect(html).toContain('action="/feedback/7/status"');
    expect(html).toContain('value="resolved"');
    expect(html).toContain('Resolve');
  });

  it('offers Reopen on a resolved row', () => {
    const html = renderFeedbackPage([row({ id: 7, status: 'resolved' })], 'clumeral.com', false, true);
    expect(html).toContain('value="open"');
    expect(html).toContain('Reopen');
  });

  it('links the GitHub issue when the row has one', () => {
    const html = renderFeedbackPage([row({ github_issue: 251 })], 'clumeral.com', false);
    expect(html).toContain('https://github.com/jevawin/clumeral-game/issues/251');
    expect(html).toContain('#251');
  });

  it('omits the issue link when there is none', () => {
    const html = renderFeedbackPage([row({ github_issue: null })], 'clumeral.com', false);
    expect(html).not.toContain('/issues/');
  });

  it('renders no resolve form for the sample data', () => {
    // Sample cards have invented ids — a button there would POST to a row that
    // does not exist.
    const html = renderFeedbackPage([], 'clumeral.com', false);
    expect(html).toContain('sample data');
    expect(html).not.toContain('/status"');
  });

  it('preserves both filters in the back value so resolving returns you here', () => {
    const html = renderFeedbackPage([row()], 'clumeral.com', true, true);
    expect(html).toContain('name="back" value="/feedback?all=1&amp;status=all"');
  });

  it('shows the flash notice after a status change', () => {
    const html = renderFeedbackPage([row()], 'clumeral.com', false, false, 'Status updated.');
    expect(html).toContain('Status updated.');
    expect(html).toContain('role="status"');
  });

  it('labels the default view as open only', () => {
    expect(renderFeedbackPage([row()], 'clumeral.com', false)).toContain('open only');
    expect(renderFeedbackPage([row()], 'clumeral.com', false, true)).not.toContain('open only');
  });
});

describe('renderFeedbackPage — escaping still holds on the new fields', () => {
  it('escapes a hostile back value rather than breaking out of the attribute', () => {
    const html = renderFeedbackPage([row()], '"><script>alert(1)</script>', false);
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
