import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createControls, type Controls, type ControlsCallbacks } from '../src/edit-mode/controls.ts';
import { createCatalogue } from '../src/edit-mode/catalogue.ts';
import { COPY } from '../src/edit-mode/copy.ts';

// C5 — the controls inside the sheet (brief items 15, 33, 34, 36, 71, 72),
// reshaped by Jamie's use on the phone across 2026-08-24 to 08-26.

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
    onCrumb: vi.fn(), onNav: vi.fn(), onToggleClass: vi.fn(), onAddClass: vi.fn(),
    onStep: vi.fn(), onUndo: vi.fn(), onResetElement: vi.fn(),
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
const byText = (text: string) => findAll('button').find((b) => b.textContent === text)!;

describe('the breadcrumb and nav (brief item 31)', () => {
  it('shows a tappable crumb per ancestor', () => {
    expect(findAll('.crumb').map((c) => c.textContent)).toEqual(['main', 'div.card', 'button']);
  });

  it('selects an ancestor in one tap', () => {
    findAll('.crumb')[1].click();
    expect(calls.onCrumb).toHaveBeenCalledWith(1);
  });

  it('separates the crumbs so they read as a path', () => {
    // Links with > between them, not a row of boxes.
    expect(findAll('.crumb-sep').map((s) => s.textContent)).toEqual(['>', '>']);
  });

  it('offers all four directions, in words as well as arrows', () => {
    // An arrow alone never says which way through the TREE it goes.
    const labels = findAll('.nav-btn').map((b) => b.textContent);
    expect(labels).toEqual(['Parent', 'Child', 'Sib', 'Sib']);
    findAll('.nav-btn').forEach((b) => b.click());
    for (const direction of ['parent', 'child', 'prev', 'next']) {
      expect(calls.onNav).toHaveBeenCalledWith(direction);
    }
  });
});

describe('class chips (brief items 33, 36)', () => {
  it('shows one chip per class', () => {
    expect(findAll('.chip-name').map((c) => c.textContent)).toEqual(['mt-4', 'flex']);
  });

  it('switches a class off when its name is tapped, rather than deleting it', () => {
    // Jamie, 2026-08-27: removing outright meant the only way back was undo,
    // and you could not see what the element used to have.
    findAll('.chip-name')[0].click();
    expect(calls.onToggleClass).toHaveBeenCalledWith('mt-4');
  });

  it('keeps a switched-off class listed, marked off, with no stepper', () => {
    controls.render({ crumbs: [], classes: ['flex'], off: ['mt-4'], desktop: false });
    const names = findAll('.chip-name').map((c) => c.textContent);
    expect(names).toContain('mt-4');
    const offChip = findAll('.chip').find((c) => c.className.includes('chip-off'))!;
    expect(offChip.querySelector('.chip-name')!.textContent).toBe('mt-4');
    // Nothing to step while it is not applied.
    expect(offChip.querySelectorAll('.chip-step')).toHaveLength(0);
  });

  it('puts the stepper INSIDE the chip it applies to', () => {
    // Separate stepper rows doubled the sheet's height for no extra
    // information (Jamie, 2026-08-26).
    expect(findAll('.chip')[0].querySelectorAll('.chip-step')).toHaveLength(2);
  });

  it('offers no stepper for a class that does not sit on a scale', () => {
    // `flex` is not a scale. A minus/plus against it could not do anything.
    expect(findAll('.chip')[1].querySelectorAll('.chip-step')).toHaveLength(0);
  });

  it('steps up and down from inside the chip', () => {
    const steps = findAll('.chip')[0].querySelectorAll('.chip-step');
    (steps[1] as HTMLElement).click();
    expect(calls.onStep).toHaveBeenCalledWith('mt-4', 'up');
    (steps[0] as HTMLElement).click();
    expect(calls.onStep).toHaveBeenCalledWith('mt-4', 'down');
  });

  it('marks the classes added in this session', () => {
    // "Indistinguishable from the original classes" otherwise. Knowing which
    // are yours is most of knowing what you have done to an element.
    controls.render({ crumbs: [], classes: ['mt-4', 'flex'], added: ['flex'], desktop: false });
    const chips = findAll('.chip');
    expect(chips[0].className).not.toContain('chip-added');
    expect(chips[1].className).toContain('chip-added');
  });
});

describe('the class picker (Jamie 2026-08-26)', () => {
  const open = () => byText('Add class').click();
  const type = (value: string) => {
    const input = find('.search-input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('offers a way in that sits with the classes it adds to', () => {
    expect(byText('Add class')).toBeTruthy();
  });

  it('covers the panel rather than squeezing in beside it', () => {
    open();
    expect(controls.pickerOpen).toBe(true);
    expect(find('.picker').hidden).toBe(false);
    // HIDDEN, not detached — detaching blurs the filter, which is what made the
    // old inline search impossible to type into.
    expect(findAll('.chip')[0].closest('div[hidden]')).toBeTruthy();
  });

  it('lists families to browse before anything is typed', () => {
    // 23,000 classes is a menu of families, not a list of classes.
    open();
    const families = findAll('.picker-family');
    expect(families.length).toBeGreaterThan(0);
    expect(families[0].textContent).toMatch(/^.+ \(\d+\)$/);
    expect(families[0].querySelector('svg.icon')).toBeTruthy();
  });

  it('expands a family to its classes, and folds it again', () => {
    open();
    findAll('.picker-family')[0].click();
    expect(findAll('.picker-class').length).toBeGreaterThan(0);
    findAll('.picker-family')[0].click();
    expect(findAll('.picker-class')).toHaveLength(0);
  });

  it('turns into a plain filter over everything once you type', () => {
    open();
    type('mt');
    expect(findAll('.picker-class').map((b) => b.textContent)).toEqual(['mt-4', 'mt-5', 'mt-6']);
  });

  it('adds the class and closes', () => {
    open();
    type('px');
    findAll('.picker-class')[1].click();
    expect(calls.onAddClass).toHaveBeenCalledWith('px-6');
    expect(controls.pickerOpen).toBe(false);
  });

  it('says what to do instead when nothing matches', () => {
    // Brief item 72: the edge of the scale is the intended next step, not a
    // dead end.
    open();
    type('zzz');
    expect(find('.search-empty').textContent).toBe(COPY.searchEmpty);
  });

  it('closes from its own back control', () => {
    open();
    (find('.picker-back') as HTMLElement).click();
    expect(controls.pickerOpen).toBe(false);
    expect(findAll('.chip').length).toBeGreaterThan(0);
  });

  it('does not let the phone autocorrect a class name', () => {
    open();
    expect(find('.search-input').getAttribute('autocapitalize')).toBe('off');
    expect(find('.search-input').getAttribute('autocorrect')).toBe('off');
  });

  it('never detaches the filter, which is what broke the old search', () => {
    open();
    const input = find('.search-input');
    controls.render({ crumbs: ['main'], classes: ['mt-4'], desktop: false });
    expect(find('.search-input')).toBe(input);
    expect(input.isConnected).toBe(true);
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

describe('the footer (brief item 71, reworded by Jamie 2026-08-26)', () => {
  it('reads Undo and Reset — Save is gone', () => {
    // The pencil saves and leaves edit mode now, so a Save button beside it
    // would be two ways to do one thing (brief item 1).
    expect(findAll('.footer button').map((b) => b.textContent))
      .toEqual(['Undo', 'Reset']);
  });

  it('says in words what the pencil now does', () => {
    // An aria-label on a glyph is invisible on a phone, so this line is the
    // only warning that tapping the pencil writes a file (brief item 46).
    expect(findAll('.hint').map((el) => el.textContent)).toEqual([COPY.pencilHint]);
  });

  it('draws its icons as SVG, not text characters', () => {
    // A character renders at whatever size its font gives it, which is why the
    // undo arrow came out tiny beside a tick (Jamie, 2026-08-27).
    for (const b of findAll('.footer button')) {
      expect(b.querySelector('svg.icon')).toBeTruthy();
    }
  });

  it('has no Close, because tapping the pencil already does that', () => {
    expect(findAll('button').map((b) => b.textContent)).not.toContain('Close');
  });

  it('calls back for each', () => {
    byText('Undo').click();
    byText('Reset').click();
    expect(calls.onUndo).toHaveBeenCalledOnce();
    expect(calls.onResetElement).toHaveBeenCalledOnce();
  });
});

describe('nothing selected yet', () => {
  it('shows no breadcrumb, but still shows the footer', () => {
    controls.render({ crumbs: [], classes: [], desktop: false });
    expect(findAll('.crumb')).toHaveLength(0);
    expect(findAll('.footer button')).toHaveLength(2);
  });
});
