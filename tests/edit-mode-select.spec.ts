import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  breadcrumb, crumb, ancestry, visibleText, describe as describeEl,
  nav, isOverlay, elementAtPoint, didNothing,
} from '../src/edit-mode/select.ts';

// C4 — selection (brief items 31, 32, 63).

beforeEach(() => {
  document.body.innerHTML = `
    <main>
      <div class="card">
        <div class="row">
          <button class="submit-btn">Submit</button>
          <button class="reset-btn">Reset the whole board back to the start again</button>
        </div>
        <p>Work out the number</p>
      </div>
    </main>
    <div data-clumeral-edit-mode><span class="panel-bit">tool</span></div>
  `;
});

afterEach(() => {
  document.body.innerHTML = '';
});

const el = (selector: string) => document.querySelector(selector)!;

describe('the breadcrumb names the path (brief item 31)', () => {
  it('reads from the landmark down to the element', () => {
    expect(breadcrumb(el('.submit-btn'))).toBe('main > div.card > div.row > button.submit-btn');
  });

  it('names a landmark bare and everything else by its first class', () => {
    // The class is what the bot greps for, so showing it means the label
    // carries the same evidence /fold will use.
    expect(crumb(el('main'))).toBe('main');
    expect(crumb(el('.card'))).toBe('div.card');
    expect(crumb(el('p'))).toBe('p');
  });

  it('names body when body is what is selected', () => {
    // No crumbs above it, but an empty breadcrumb would read as broken.
    expect(breadcrumb(document.body)).toBe('body');
  });

  it('gives every ancestor as a tappable crumb', () => {
    // This is what makes a wrapper reachable in ONE tap. A tap selects the
    // topmost element, which is usually the innermost, so without the
    // breadcrumb a wrapper sharing its child's exact box cannot be selected
    // at all.
    const chain = ancestry(el('.submit-btn'));
    expect(chain.map((e) => e.tagName.toLowerCase())).toEqual(['main', 'div', 'div', 'button']);
  });

  it('tells two identical boxes apart by their path', () => {
    // The design's original answer was a source location on the label. That is
    // impossible now (item 32), and the path does the same job.
    expect(breadcrumb(el('.submit-btn'))).not.toBe(breadcrumb(el('.reset-btn')));
  });
});

describe('the selection label (brief item 32)', () => {
  it('shows the tag, the path and the first few words of text', () => {
    expect(describeEl(el('.submit-btn'))).toEqual({
      tag: 'button',
      breadcrumb: 'main > div.card > div.row > button.submit-btn',
      text: 'Submit',
    });
  });

  it('carries NO source location', () => {
    // The approved design specifies one; nothing in the browser can know it now
    // that build-time stamping is rejected. Jamie approved the departure on
    // 2026-08-19. This test is what stops it creeping back in as a guess.
    const described = describeEl(el('.submit-btn'));
    const asText = JSON.stringify(described);
    expect(asText).not.toMatch(/\.ts:\d+/);
    expect(asText).not.toMatch(/\.html:\d+/);
    expect(Object.keys(described).sort()).toEqual(['breadcrumb', 'tag', 'text']);
  });

  it('truncates long text rather than filling the label', () => {
    expect(visibleText(el('.reset-btn'))).toBe('Reset the whole board back to…');
  });

  it('collapses whitespace so markup indentation does not leak in', () => {
    expect(visibleText(el('.card'))).not.toContain('\n');
  });

  it('gives an empty string for an element with no text', () => {
    document.body.innerHTML = '<div class="empty"><span></span></div>';
    expect(visibleText(el('.empty'))).toBe('');
  });
});

describe('the tool is never selectable (brief item 63)', () => {
  it('recognises the overlay host', () => {
    expect(isOverlay(el('[data-clumeral-edit-mode]'))).toBe(true);
  });

  it('recognises something nested inside the overlay', () => {
    expect(isOverlay(el('.panel-bit'))).toBe(true);
  });

  it('does not mistake the page for the overlay', () => {
    expect(isOverlay(el('.submit-btn'))).toBe(false);
    expect(isOverlay(el('main'))).toBe(false);
  });

  it('picks the page element under a tap, not the panel on top of it', () => {
    // The panel is fixed over the page, so without this every tap would select
    // the tool and the breadcrumb would be nonsense.
    const overlay = el('[data-clumeral-edit-mode]');
    const target = el('.submit-btn');
    document.elementsFromPoint = () => [overlay, target, el('main')];
    expect(elementAtPoint(document, 10, 10)).toBe(target);
  });

  it('returns nothing when only the overlay is under the point', () => {
    document.elementsFromPoint = () => [el('[data-clumeral-edit-mode]')];
    expect(elementAtPoint(document, 10, 10)).toBeNull();
  });
});

describe('stepping between elements (brief item 31)', () => {
  it('goes up to the parent', () => {
    expect(nav.parent(el('.submit-btn'))).toBe(el('.row'));
  });

  it('stops at body rather than walking out of the document', () => {
    expect(nav.parent(document.body)).toBeNull();
  });

  it('goes down to the first child', () => {
    expect(nav.firstChild(el('.row'))).toBe(el('.submit-btn'));
  });

  it('goes sideways between siblings', () => {
    expect(nav.next(el('.submit-btn'))).toBe(el('.reset-btn'));
    expect(nav.previous(el('.reset-btn'))).toBe(el('.submit-btn'));
  });

  it('returns nothing at the ends', () => {
    expect(nav.previous(el('.submit-btn'))).toBeNull();
    expect(nav.firstChild(el('.submit-btn'))).toBeNull();
  });

  it('steps over the overlay instead of landing on it', () => {
    // The overlay host is a sibling of <main> in <body>. Without skipping it,
    // stepping through body's children selects the tool.
    expect(nav.next(el('main'))).toBeNull();
    expect(nav.firstChild(document.body)).toBe(el('main'));
  });
});

describe('did the class actually do anything (brief item 99)', () => {
  it('spots a class that changed nothing', () => {
    expect(didNothing('color: red;', 'color: red;')).toBe(true);
  });

  it('spots a class that did', () => {
    expect(didNothing('color: red;', 'color: blue;')).toBe(false);
  });
});
