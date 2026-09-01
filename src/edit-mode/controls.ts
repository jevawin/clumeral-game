// Clumeral edit mode — the controls inside the sheet.
//
// Breadcrumb, nav, class chips, the class picker, and on desktop a raw class
// field and a free-CSS box (brief items 33, 34, 15).
//
// Rendered into the sealed shadow root, so none of it can use the project's
// Tailwind classes — the styling lives in panel.ts and is hand-written.

import type { Catalogue } from './catalogue.ts';
import { search, familyLabel } from './catalogue.ts';
import { isSteppable } from './scale.ts';
import { COPY } from './copy.ts';
import { icon } from './icons.ts';

export interface ControlsState {
  /** Breadcrumb crumbs, outermost first. Empty when nothing is selected. */
  crumbs: string[];
  /** The selected element's classes, in order. */
  classes: string[];
  /** Of those, the ones added in this session. */
  added?: string[];
  /**
   * Classes switched off rather than removed.
   *
   * Jamie, 2026-08-24 and again 08-27: "tap chip to deselect, keep in list but
   * greyed out, tap again to reapply. Then I can easily see what I removed and
   * put it back." Removing outright meant the only way back was undo, and you
   * could not see what the element used to have.
   */
  off?: string[];
  /**
   * The order to draw the chips in, holding switched-off classes in place.
   *
   * Without it a chip jumps to the end of the row the moment it is switched
   * off and back again when switched on, which is half of what Jamie meant by
   * "really jumpy and janky" on 2026-08-29.
   */
  order?: string[];
  /** Desktop gets the raw field and the free-CSS box (brief item 34). */
  desktop: boolean;
}

export interface ControlsCallbacks {
  onCrumb(index: number): void;
  onNav(direction: 'parent' | 'child' | 'prev' | 'next'): void;
  /** Switch a class off, or back on if it is already off. */
  onToggleClass(name: string): void;
  onAddClass(name: string): void;
  onStep(name: string, direction: 'up' | 'down'): void;
  onUndo(): void;
  onResetElement(): void;
  onRawClasses(value: string): void;
  onFreeCss(value: string): void;
  /** So the selected element can be scrolled clear of the keyboard. */
  onSearchFocus(focused: boolean): void;
}

export interface Controls {
  render(state: ControlsState): void;
  /** Is the class picker covering the panel? */
  readonly pickerOpen: boolean;
  /** Close the picker. The pencil does this too, which is why there is no Close. */
  closePicker(): void;
  destroy(): void;
}

/**
 * How many families to list before the filter narrows things.
 *
 * The catalogue is 23,000 classes across 21,000 property signatures, so the
 * unfiltered list is a menu of families, not of classes. Typing turns it into a
 * filter over everything (Jamie, 2026-08-26: "might be a massive list but then
 * search is just a text filter and list can be grouped").
 */
const FAMILY_MENU_CAP = 40;

export function createControls(
  doc: Document,
  sheet: HTMLElement,
  catalogue: Catalogue,
  callbacks: ControlsCallbacks
): Controls {
  let pickerOpen = false;
  let expandedFamily: string | null = null;
  let state: ControlsState = { crumbs: [], classes: [], added: [], off: [], desktop: false };

  const container = doc.createElement('div');
  sheet.appendChild(container);

  function button(
    label: string,
    onClick: () => void,
    className = '',
    iconName?: string
  ): HTMLButtonElement {
    const btn = doc.createElement('button');
    btn.type = 'button';
    if (className) btn.className = className;
    // Lucide SVG rather than a text glyph: a character renders at whatever size
    // its font gives it, which is why the undo arrow came out tiny beside a
    // tick (Jamie, 2026-08-27).
    btn.innerHTML = iconName ? icon(iconName) : '';
    if (label) {
      const text = doc.createElement('span');
      text.textContent = label;
      btn.appendChild(text);
    }
    if (!label && iconName) btn.setAttribute('aria-label', iconName);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function row(className: string): HTMLDivElement {
    const div = doc.createElement('div');
    div.className = `row ${className}`;
    return div;
  }

  // ── The class picker ──────────────────────────────────────────────────────
  //
  // Jamie's design, 2026-08-26: an "Add class" button that covers the panel with
  // a picker. Better than an inline search box, because the picker owns the
  // whole sheet and nothing has to shuffle around the keyboard.
  //
  // Mounted ONCE and never detached: removing a focused element blurs it, which
  // is what made the old inline search impossible to type into.

  const picker = doc.createElement('div');
  picker.className = 'picker';
  picker.hidden = true;

  const filter = doc.createElement('input');
  filter.type = 'search';
  filter.className = 'search-input';
  filter.placeholder = COPY.searchPlaceholder;
  filter.setAttribute('autocapitalize', 'off');
  filter.setAttribute('autocorrect', 'off');
  filter.setAttribute('spellcheck', 'false');
  filter.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    filter.focus();
  });

  const pickerHead = row('picker-head');
  pickerHead.appendChild(button('', () => closePicker(), 'picker-back', 'back'));
  pickerHead.appendChild(filter);

  const results = doc.createElement('div');
  results.className = 'picker-list';

  picker.appendChild(pickerHead);
  picker.appendChild(results);
  sheet.appendChild(picker);

  /** Every family in the catalogue, biggest first. The unfiltered menu. */
  function familyMenu(): { family: string; classes: string[] }[] {
    const byFamily = new Map<string, string[]>();
    for (const name of catalogue.classes) {
      const label = familyLabel(catalogue.properties(name));
      const bucket = byFamily.get(label);
      if (bucket) bucket.push(name);
      else byFamily.set(label, [name]);
    }
    return [...byFamily.entries()]
      .map(([family, classes]) => ({ family, classes }))
      .sort((a, b) => b.classes.length - a.classes.length)
      .slice(0, FAMILY_MENU_CAP);
  }

  function classButton(name: string): HTMLButtonElement {
    return button(name, () => {
      callbacks.onAddClass(name);
      closePicker();
    }, 'picker-class');
  }

  function drawPicker(): void {
    results.replaceChildren();
    const query = filter.value.trim();

    if (query) {
      const groups = search(catalogue, query, { perFamily: 24, maxFamilies: 12 });
      if (groups.length === 0) {
        const empty = doc.createElement('p');
        empty.className = 'search-empty';
        empty.textContent = COPY.searchEmpty;
        results.appendChild(empty);
        return;
      }
      for (const group of groups) {
        const heading = doc.createElement('p');
        heading.className = 'search-family';
        heading.textContent = group.total > group.matches.length
          ? `${group.family} (${group.matches.length} of ${group.total})`
          : group.family;
        results.appendChild(heading);
        const list = row('search-group');
        for (const name of group.matches) list.appendChild(classButton(name));
        results.appendChild(list);
      }
      return;
    }

    // No filter: a menu of families. Tap one to see its classes.
    for (const { family, classes } of familyMenu()) {
      const heading = button(
        `${family} (${classes.length})`,
        () => {
          expandedFamily = expandedFamily === family ? null : family;
          drawPicker();
        },
        'picker-family',
        expandedFamily === family ? 'expanded' : 'collapsed'
      );
      results.appendChild(heading);

      if (expandedFamily === family) {
        const list = row('search-group');
        for (const name of classes.slice(0, 48)) list.appendChild(classButton(name));
        results.appendChild(list);
      }
    }
  }

  filter.addEventListener('input', drawPicker);
  filter.addEventListener('focus', () => callbacks.onSearchFocus(true));
  filter.addEventListener('blur', () => callbacks.onSearchFocus(false));

  function openPicker(): void {
    pickerOpen = true;
    expandedFamily = null;
    filter.value = '';
    drawPicker();
    draw();
    filter.focus();
  }

  function closePicker(): void {
    pickerOpen = false;
    filter.blur();
    callbacks.onSearchFocus(false);
    draw();
  }

  // ── The panel itself ──────────────────────────────────────────────────────

  function draw(): void {
    // The picker covers the panel rather than replacing it, so nothing inside
    // either is ever detached.
    container.hidden = pickerOpen;
    picker.hidden = !pickerOpen;
    if (pickerOpen) return;

    container.replaceChildren();

    if (state.crumbs.length) {
      const crumbs = row('breadcrumb');
      state.crumbs.forEach((name, index) => {
        if (index > 0) {
          const sep = doc.createElement('span');
          sep.className = 'crumb-sep';
          sep.textContent = '>';
          crumbs.appendChild(sep);
        }
        const link = doc.createElement('a');
        link.className = 'crumb';
        link.setAttribute('role', 'button');
        link.tabIndex = 0;
        link.textContent = name;
        link.addEventListener('click', () => callbacks.onCrumb(index));
        crumbs.appendChild(link);
      });
      container.appendChild(crumbs);

      const arrows = row('nav');
      const directions: [string, 'parent' | 'child' | 'prev' | 'next'][] = [
        ['Parent', 'parent'], ['Child', 'child'], ['Sib', 'prev'], ['Sib', 'next'],
      ];
      for (const [label, direction] of directions) {
        arrows.appendChild(button(label, () => callbacks.onNav(direction), 'nav-btn', direction));
      }
      container.appendChild(arrows);
    }

    // One chip per class, with its stepper built in where it has a scale.
    // Switched-off classes stay in the list, greyed out, so you can see what
    // you took off and put it back with one tap.
    const chips = row('chips');
    const added = new Set(state.added ?? []);
    const off = new Set(state.off ?? []);
    const fallback = [...state.classes, ...(state.off ?? []).filter((c) => !state.classes.includes(c))];
    // The caller's order first, then anything it did not know about.
    const listed = state.order
      ? [...state.order.filter((c) => fallback.includes(c)),
         ...fallback.filter((c) => !state.order!.includes(c))]
      : fallback;

    for (const name of listed) {
      const isOff = off.has(name);
      const chip = doc.createElement('span');
      chip.className = [
        'chip',
        added.has(name) ? 'chip-added' : '',
        isOff ? 'chip-off' : '',
      ].filter(Boolean).join(' ');

      // A switched-off class has nothing to step.
      const steppable = !isOff && isSteppable(catalogue, name);
      if (steppable) {
        chip.appendChild(button('', () => callbacks.onStep(name, 'down'), 'chip-step', 'minus'));
      }

      const label = doc.createElement('button');
      label.type = 'button';
      label.className = 'chip-name';
      label.textContent = name;
      label.addEventListener('click', () => callbacks.onToggleClass(name));
      chip.appendChild(label);

      if (steppable) {
        chip.appendChild(button('', () => callbacks.onStep(name, 'up'), 'chip-step', 'plus'));
      }
      chips.appendChild(chip);
    }
    // The way in to the picker sits with the classes it adds to.
    chips.appendChild(button('Add class', openPicker, 'add-class', 'plus'));
    container.appendChild(chips);

    if (state.desktop) {
      const raw = doc.createElement('input');
      raw.type = 'text';
      raw.className = 'raw-classes';
      raw.placeholder = 'Raw classes';
      raw.addEventListener('change', () => callbacks.onRawClasses(raw.value));
      container.appendChild(raw);

      const css = doc.createElement('textarea');
      css.className = 'free-css';
      css.placeholder = 'margin-top: 1rem;';
      css.addEventListener('change', () => callbacks.onFreeCss(css.value));
      container.appendChild(css);
    }

    // Icons and Jamie's wording, 2026-08-26. No Close and no Save: tapping the
    // pencil saves and leaves edit mode, which is both of them in one control
    // (brief item 1).
    const footer = row('footer');
    footer.appendChild(button(COPY.undo, callbacks.onUndo, '', 'undo'));
    footer.appendChild(button(COPY.resetElement, callbacks.onResetElement, '', 'reset'));
    container.appendChild(footer);

    // The pencil has no visible text, so its label is an aria-label Jamie will
    // never see on a phone. This line is the only actual warning that a tap
    // writes a file (brief item 46).
    const hint = row('hint');
    hint.textContent = COPY.pencilHint;
    container.appendChild(hint);
  }

  return {
    render(next) {
      state = next;
      draw();
    },
    get pickerOpen() { return pickerOpen; },
    closePicker,
    destroy() {
      container.remove();
      picker.remove();
    },
  };
}
