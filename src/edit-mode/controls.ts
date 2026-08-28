// Clumeral edit mode — the controls inside the sheet.
//
// Breadcrumb, nav arrows, class chips, search, steppers, and on desktop a raw
// class field and a free-CSS box (brief items 33, 34, 15).
//
// Rendered into the sealed shadow root, so none of it can use the project's
// Tailwind classes — the styling lives in panel.ts and is hand-written.

import type { Catalogue } from './catalogue.ts';
import { search } from './catalogue.ts';
import { isSteppable } from './scale.ts';
import { COPY } from './copy.ts';

export interface ControlsState {
  /** Breadcrumb crumbs, outermost first. Empty when nothing is selected. */
  crumbs: string[];
  /** The selected element's classes, in order. */
  classes: string[];
  /** Desktop gets the raw field and the free-CSS box (brief item 34). */
  desktop: boolean;
}

export interface ControlsCallbacks {
  onCrumb(index: number): void;
  onNav(direction: 'parent' | 'child' | 'prev' | 'next'): void;
  onRemoveClass(name: string): void;
  onAddClass(name: string): void;
  onStep(name: string, direction: 'up' | 'down'): void;
  onUndo(): void;
  onResetElement(): void;
  onDone(): void;
  onRawClasses(value: string): void;
  onFreeCss(value: string): void;
  /** So the selected element can be scrolled clear of the keyboard. */
  onSearchFocus(focused: boolean): void;
}

export interface Controls {
  render(state: ControlsState): void;
  /** Is the sheet collapsed to search and results only? */
  readonly searchOpen: boolean;
  destroy(): void;
}

export function createControls(
  doc: Document,
  sheet: HTMLElement,
  catalogue: Catalogue,
  callbacks: ControlsCallbacks
): Controls {
  let searchOpen = false;
  let state: ControlsState = { crumbs: [], classes: [], desktop: false };

  // Rebuilt on every draw.
  const container = doc.createElement('div');
  sheet.appendChild(container);

  function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    if (className) btn.className = className;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function row(className: string): HTMLDivElement {
    const div = doc.createElement('div');
    div.className = `row ${className}`;
    return div;
  }

  const input = doc.createElement('input');

  function renderSearch(): HTMLElement {
    const wrap = row('search-row');
    input.type = 'search';
    input.className = 'search-input';
    input.placeholder = COPY.searchPlaceholder;
    // Phones capitalise and autocorrect by default, which mangles class names
    // into things the catalogue will never match.
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');

    const results = doc.createElement('div');
    results.className = 'search-results';

    // Jamie, 2026-08-24: "doesn't activate the keyboard when tapped". The
    // collapse below keys on the focus event, so no focus meant the sheet
    // collapsed with no way back — his "can't get out".
    input.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      input.focus();
    });

    input.addEventListener('focus', () => {
      // Brief item 33: the sheet collapses to search and results only, and the
      // selected element is scrolled above it. Without this the on-screen
      // keyboard covers the very element being edited.
      searchOpen = true;
      draw();
      callbacks.onSearchFocus(true);
    });

    input.addEventListener('blur', () => {
      searchOpen = false;
      callbacks.onSearchFocus(false);
      draw();
    });

    input.addEventListener('input', () => {
      results.replaceChildren();
      const groups = search(catalogue, input.value);

      if (input.value.trim() && groups.length === 0) {
        const empty = doc.createElement('p');
        empty.className = 'search-empty';
        // Not a bare "no results": the edge of the scale is the intended next
        // step, so it says what to do instead (brief item 72).
        empty.textContent = COPY.searchEmpty;
        results.appendChild(empty);
        return;
      }

      for (const group of groups) {
        const heading = doc.createElement('p');
        heading.className = 'search-family';
        // The true total, not the shown count — a capped group must not read
        // as "that is all there is".
        heading.textContent = group.total > group.matches.length
          ? `${group.family} (${group.matches.length} of ${group.total})`
          : group.family;
        results.appendChild(heading);

        const list = row('search-group');
        for (const name of group.matches) {
          list.appendChild(button(name, () => {
            callbacks.onAddClass(name);
            input.value = '';
            results.replaceChildren();
          }));
        }
        results.appendChild(list);
      }
    });

    wrap.appendChild(input);
    const holder = doc.createElement('div');
    holder.appendChild(wrap);
    holder.appendChild(results);
    return holder;
  }

  /**
   * Mounted ONCE and never detached.
   *
   * It used to live inside `container`, which draw() rebuilds with
   * replaceChildren(). Detaching a focused element blurs it — so focusing the
   * search box triggered a draw, the draw detached the box, the blur closed the
   * search again, and the keyboard shut the instant it opened. Focus could not
   * survive its own first render. Keeping it out of the rebuilt subtree is the
   * whole fix (Jamie, 2026-08-25: "search doesn't work").
   */
  const searchBlock = renderSearch();
  const searchBar = row('search-bar');
  const closeSearch = button('Close', () => {
    searchOpen = false;
    input.blur();
    callbacks.onSearchFocus(false);
    draw();
  }, 'search-close');
  searchBar.appendChild(closeSearch);
  searchBar.hidden = true;
  sheet.appendChild(searchBar);
  sheet.appendChild(searchBlock);

  function draw(): void {
    // Collapsed to search and results only, so the keyboard cannot cover the
    // element being edited — by HIDING the rest, never by detaching it.
    container.hidden = searchOpen;
    searchBar.hidden = !searchOpen;
    if (searchOpen) return;

    container.replaceChildren();

    if (state.crumbs.length) {
      const crumbs = row('breadcrumb');
      state.crumbs.forEach((name, index) => {
        crumbs.appendChild(button(name, () => callbacks.onCrumb(index), 'crumb'));
      });
      container.appendChild(crumbs);

      const arrows = row('nav');
      arrows.appendChild(button('↑', () => callbacks.onNav('parent')));
      arrows.appendChild(button('↓', () => callbacks.onNav('child')));
      arrows.appendChild(button('←', () => callbacks.onNav('prev')));
      arrows.appendChild(button('→', () => callbacks.onNav('next')));
      container.appendChild(arrows);
    }

    const chips = row('chips');
    for (const name of state.classes) {
      // Tap a chip to remove it (brief item 33).
      chips.appendChild(button(`${name} ×`, () => callbacks.onRemoveClass(name), 'chip'));
    }
    container.appendChild(chips);

    // Steppers walk the scale; search picks the utility. Two jobs, which is why
    // search never has to enumerate every step (brief item 36).
    for (const name of state.classes.filter((c) => isSteppable(catalogue, c))) {
      const stepper = row('stepper');
      const label = doc.createElement('span');
      label.className = 'stepper-label';
      label.textContent = name;
      stepper.appendChild(button('−', () => callbacks.onStep(name, 'down')));
      stepper.appendChild(label);
      stepper.appendChild(button('+', () => callbacks.onStep(name, 'up')));
      container.appendChild(stepper);
    }

    if (state.desktop) {
      // Item 15: a free-CSS entry is not a class change, which is why the
      // session file carries more than one kind of patch.
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

    const footer = row('footer');
    footer.appendChild(button(COPY.undo, callbacks.onUndo));
    footer.appendChild(button(COPY.resetElement, callbacks.onResetElement));
    footer.appendChild(button(COPY.done, callbacks.onDone));
    container.appendChild(footer);
  }

  return {
    render(next) {
      state = next;
      draw();
    },
    get searchOpen() { return searchOpen; },
    destroy() { container.remove(); },
  };
}
