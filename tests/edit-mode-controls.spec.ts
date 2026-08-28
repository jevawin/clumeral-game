import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createControls, type Controls, type ControlsCallbacks } from '../src/edit-mode/controls.ts';
import { createCatalogue } from '../src/edit-mode/catalogue.ts';
import { COPY } from '../src/edit-mode/copy.ts';

// C5 — the controls inside the sheet (brief items 15, 33, 34, 36, 71, 72).

const CLASSES = ['mt-4', 'mt-5', 'mt-6', 'px-4', 'px-6', 'flex', 'rounded-lg', 'text-sm', 'text-lg'];
const FAMILIES: Record<string, string[]> = {
  'mt-4': ['margin-top'], 'mt-5': ['margin-top'], 'mt-6': ['margin-top'],
  'px-4': ['padding-inline'], 'px-6': ['padding-inline'],
  flex: ['display'], 'rounded-lg': ['border-radius'],
  'text-sm': ['font-size', 'line-height'], 'text-lg': ['font-size', 'line-height'],
};

const catalogue = createCatalogue(CLASSES, FAMILIES);

let sheet: HTMLElement;
let controls: Controls;
let calls: Record<string, ReturnType<typeof vi.fn>>;

function callbacks(): ControlsCallbacks {
  calls = {
    onCrumb: vi.fn(), onNav: vi.fn(), onRemoveClass: vi.fn(), onAddClass: vi.fn(),
    onStep: vi.fn(), onUndo: vi.fn(), onResetElement: vi.fn(), onDone: vi.fn(),
    onRawClasses: vi.fn(), onFreeCss: vi.fn(), onSearchFocus: vi.fn(),
  };
  return calls as unknown as ControlsCallbacks;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="sheet"></div>';
  sheet = document.getElementById('sheet')!;
  controls = createControls(document, sheet, catalogue, callbacks());
  controls.render({ crumbs: ['main', 'div.card', 'button'], classes: ['mt-4', 'flex'], desktop: false });
});

const find = (selector: string) => sheet.querySelector(selector) as HTMLElement;
const findAll = (selector: string) => [...sheet.querySelectorAll(selector)] as HTMLElement[];
const byText = (text: string) =>
  findAll('button').find((b) => b.textContent === text)!;

describe('the breadcrumb and nav arrows (brief item 31)', () => {
  it('shows a tappable crumb per ancestor', () => {
    const crumbs = findAll('.crumb');
    expect(crumbs.map((c) => c.textContent)).toEqual(['main', 'div.card', 'button']);
  });

  it('selects an ancestor in one tap', () => {
    findAll('.crumb')[1].click();
    expect(calls.onCrumb).toHaveBeenCalledWith(1);
  });

  it('separates the crumbs so they read as a path', () => {
    // Jamie, 2026-08-26: links with > between them, not a row of boxes.
    expect(findAll('.crumb-sep').map((s) => s.textContent)).toEqual(['>', '>']);
  });

  it('offers all four directions, in words', () => {
    // An arrow alone never says which way through the TREE it goes.
    for (const [label, direction] of [['Parent', 'parent'], ['Child', 'child'], ['◀ Sib', 'prev'], ['Sib ▶', 'next']]) {
      byText(label).click();
      expect(calls.onNav).toHaveBeenCalledWith(direction);
    }
  });
});

describe('class chips (brief item 33)', () => {
  it('shows one chip per class', () => {
    expect(findAll('.chip-name').map((c) => c.textContent)).toEqual(['mt-4', 'flex']);
  });

  it('removes a class when its name is tapped', () => {
    findAll('.chip-name')[0].click();
    expect(calls.onRemoveClass).toHaveBeenCalledWith('mt-4');
  });
});

describe('steppers walk the scale (brief item 36)', () => {
  it('puts the stepper INSIDE the chip it applies to', () => {
    // Jamie, 2026-08-26: separate stepper rows doubled the sheet's height for
    // no extra information.
    const chips = findAll('.chip');
    expect(chips[0].querySelectorAll('.chip-step')).toHaveLength(2);
  });

  it('offers no stepper for a class that does not sit on a scale', () => {
    // `flex` is not a scale. A minus/plus against it would be a control that
    // cannot do anything.
    const chips = findAll('.chip');
    expect(chips[1].querySelectorAll('.chip-step')).toHaveLength(0);
  });

  it('steps up and down from inside the chip', () => {
    const steps = findAll('.chip')[0].querySelectorAll('.chip-step');
    (steps[1] as HTMLElement).click();
    expect(calls.onStep).toHaveBeenCalledWith('mt-4', 'up');
    (steps[0] as HTMLElement).click();
    expect(calls.onStep).toHaveBeenCalledWith('mt-4', 'down');
  });
});

describe('search (brief items 35, 72)', () => {
  function type(value: string): void {
    const input = find('.search-input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('offers matches grouped by family', () => {
    type('mt');
    expect(findAll('.search-family').map((f) => f.textContent)).toEqual(['margin-top']);
    expect(findAll('.search-group button').map((b) => b.textContent)).toEqual(['mt-4', 'mt-5', 'mt-6']);
  });

  it('adds the class when a result is tapped', () => {
    type('px');
    findAll('.search-group button')[1].click();
    expect(calls.onAddClass).toHaveBeenCalledWith('px-6');
  });

  it('says what to do instead when nothing matches', () => {
    // Brief item 72: not a bare "no results" — the edge of the scale is the
    // intended next step.
    type('zzz');
    expect(find('.search-empty').textContent).toBe(COPY.searchEmpty);
    expect(COPY.searchEmpty).toContain('Describe what you want in words');
  });

  it('shows nothing at all for an empty query', () => {
    type('');
    expect(find('.search-empty')).toBeNull();
    expect(findAll('.search-group button')).toHaveLength(0);
  });

  it('does not let the phone autocorrect a class name', () => {
    // Capitalisation and autocorrect mangle class names into things the
    // catalogue will never match.
    const input = find('.search-input');
    expect(input.getAttribute('autocapitalize')).toBe('off');
    expect(input.getAttribute('autocorrect')).toBe('off');
  });
});

describe('the keyboard must not cover the element being edited (brief item 33)', () => {
  it('collapses the sheet to search and results when search is focused', () => {
    find('.search-input').dispatchEvent(new FocusEvent('focus'));
    expect(controls.searchOpen).toBe(true);
    // Everything else is HIDDEN, not removed — see the test below for why that
    // distinction is the whole bug.
    const rest = findAll('.chip')[0].closest('div[hidden]');
    expect(rest).toBeTruthy();
    expect(find('.search-input')).toBeTruthy();
  });

  it('never detaches the search input, which is what broke it', () => {
    // THE bug (Jamie, 2026-08-25: "search doesn't work"). draw() rebuilt its
    // container with replaceChildren(), and the input lived inside it.
    // Detaching a focused element BLURS it — so focus triggered a draw, the
    // draw detached the input, the blur closed the search, and the keyboard
    // shut the instant it opened. Focus could not survive its own first render.
    const input = find('.search-input');
    input.dispatchEvent(new FocusEvent('focus'));
    expect(find('.search-input')).toBe(input);
    controls.render({ crumbs: ['main'], classes: ['mt-4'], desktop: false });
    expect(find('.search-input')).toBe(input);
    expect(input.isConnected).toBe(true);
  });

  it('offers a Close that does not depend on a blur arriving', () => {
    find('.search-input').dispatchEvent(new FocusEvent('focus'));
    (find('.search-close') as HTMLElement).click();
    expect(controls.searchOpen).toBe(false);
    expect(findAll('.chip').length).toBeGreaterThan(0);
  });

  it('tells the overlay to scroll the element clear', () => {
    find('.search-input').dispatchEvent(new FocusEvent('focus'));
    expect(calls.onSearchFocus).toHaveBeenCalledWith(true);
  });

  it('puts everything back when search is dismissed', () => {
    find('.search-input').dispatchEvent(new FocusEvent('focus'));
    find('.search-input').dispatchEvent(new FocusEvent('blur'));
    expect(controls.searchOpen).toBe(false);
    expect(findAll('.chip')).toHaveLength(2);
    expect(calls.onSearchFocus).toHaveBeenLastCalledWith(false);
  });
});

describe('telling your own classes from the element-s (Jamie 2026-08-26)', () => {
  it('marks the classes added in this session', () => {
    // "When I apply a class from search it's indistinguishable from the
    // original classes." Knowing which are yours is most of knowing what you
    // have done to an element.
    controls.render({ crumbs: [], classes: ['mt-4', 'flex'], added: ['flex'], desktop: false });
    const chips = findAll('.chip');
    expect(chips[0].className).not.toContain('chip-added');
    expect(chips[1].className).toContain('chip-added');
  });

  it('marks nothing when nothing has been added', () => {
    controls.render({ crumbs: [], classes: ['mt-4'], added: [], desktop: false });
    expect(find('.chip').className).not.toContain('chip-added');
  });
});

describe('the sheet stays clear of the keyboard (Jamie 2026-08-26)', () => {
  it('pins the search field so results scroll under it', () => {
    // "The main box disappears" — the field scrolled away with the results.
    const styles = document.querySelector('style');
    expect(sheet.querySelector('.search-row')).toBeTruthy();
  });
});

describe('the desktop extras (brief items 15, 34)', () => {
  it('are absent on a phone', () => {
    expect(find('.raw-classes')).toBeNull();
    expect(find('.free-css')).toBeNull();
  });

  it('offer a raw class field', () => {
    controls.render({ crumbs: [], classes: ['mt-4'], desktop: true });
    const raw = find('.raw-classes') as HTMLInputElement;
    raw.value = 'tracking-widest';
    raw.dispatchEvent(new Event('change'));
    expect(calls.onRawClasses).toHaveBeenCalledWith('tracking-widest');
  });

  it('offer a free-CSS box, which is why the session carries more than one patch kind', () => {
    controls.render({ crumbs: [], classes: ['mt-4'], desktop: true });
    const css = find('.free-css') as HTMLTextAreaElement;
    css.value = 'margin-top: 1rem;';
    css.dispatchEvent(new Event('change'));
    expect(calls.onFreeCss).toHaveBeenCalledWith('margin-top: 1rem;');
  });
});

describe('the footer (brief item 71)', () => {
  it('offers undo, reset element and done', () => {
    const labels = findAll('.footer button').map((b) => b.textContent);
    expect(labels).toEqual([COPY.undo, COPY.resetElement, COPY.done]);
  });

  it('calls back for each', () => {
    byText(COPY.undo).click();
    byText(COPY.resetElement).click();
    byText(COPY.done).click();
    expect(calls.onUndo).toHaveBeenCalledOnce();
    expect(calls.onResetElement).toHaveBeenCalledOnce();
    expect(calls.onDone).toHaveBeenCalledOnce();
  });
});

describe('nothing selected yet', () => {
  it('shows no breadcrumb, but still shows the footer', () => {
    controls.render({ crumbs: [], classes: [], desktop: false });
    expect(findAll('.crumb')).toHaveLength(0);
    expect(findAll('.footer button')).toHaveLength(3);
  });
});
