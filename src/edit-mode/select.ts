// Clumeral edit mode — choosing which element to edit.
//
// A tap selects the topmost element under the point, which is usually the
// innermost — leaving wrappers that share their child's exact box unreachable.
// Two mechanisms fix that, both borrowed from DevTools: a breadcrumb that
// reaches any ancestor in one tap, and thumb-sized arrows for stepping between
// elements whose boxes are visually identical (brief item 31).

/** How much visible text goes in the label and the patch. */
const TEXT_WORDS = 6;

export interface Described {
  tag: string;
  /** `main > .card > .row > button` */
  breadcrumb: string;
  /** The first few words of visible text. */
  text: string;
}

/** Is this node the tool rather than the page? */
export function isOverlay(node: Node | null): boolean {
  let el: Node | null = node;
  while (el) {
    if (el instanceof Element && el.hasAttribute('data-clumeral-edit-mode')) return true;
    el = el.parentNode ?? (el as ShadowRoot).host ?? null;
  }
  return false;
}

/**
 * The element under a tap.
 *
 * The overlay is skipped, so tapping through the panel selects the page
 * underneath rather than the tool itself. Brief item 63: otherwise the tool can
 * select itself and the breadcrumb becomes nonsense.
 */
export function elementAtPoint(doc: Document, x: number, y: number): Element | null {
  const stack = doc.elementsFromPoint(x, y);
  for (const el of stack) {
    if (!isOverlay(el)) return el;
  }
  return null;
}

/** One crumb: how this element is written in the breadcrumb. */
export function crumb(el: Element): string {
  const tag = el.tagName.toLowerCase();
  // Landmarks read better bare; everything else is easier to find in source by
  // its first class, which is also what the bot will grep for.
  if (['main', 'body', 'html', 'header', 'footer', 'nav'].includes(tag)) return tag;
  const first = el.classList[0];
  return first ? `${tag}.${first}` : tag;
}

/**
 * The crumbs, outermost first.
 *
 * Stops BELOW <body>. Every element on the page is inside body, so a "body >"
 * on the front of every breadcrumb spends horizontal space on a phone to say
 * nothing. Body is still reachable — the up arrow from the outermost crumb goes
 * there — which matters, because selecting <body> is exactly the case the sealed
 * panel exists for (brief item 64).
 */
export function ancestry(el: Element): Element[] {
  const chain: Element[] = [];
  let current: Element | null = el;
  while (current && !['body', 'html'].includes(current.tagName.toLowerCase())) {
    chain.unshift(current);
    current = current.parentElement;
  }
  return chain;
}

export function breadcrumb(el: Element): string {
  const chain = ancestry(el);
  // Selecting <body> itself has no crumbs above it, so name it rather than
  // showing an empty breadcrumb.
  return chain.length ? chain.map(crumb).join(' > ') : crumb(el);
}

/** The first few words the element actually shows. */
export function visibleText(el: Element): string {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const words = text.split(' ');
  return words.length <= TEXT_WORDS ? text : `${words.slice(0, TEXT_WORDS).join(' ')}…`;
}

/**
 * What the label shows, and what goes in the patch.
 *
 * NO SOURCE LOCATION. The approved design says the label shows the element's
 * source file and line, and it cannot: build-time source stamping was rejected,
 * so nothing in the browser knows which file an element came from. Jamie
 * approved this departure on 2026-08-19 (brief item 32).
 *
 * What is here instead is exactly what the bot greps on — tag, path, and the
 * first few words of text — so the label shows Jamie the same evidence /fold
 * will use. Two identical boxes are told apart by their path, which is what the
 * breadcrumb already gives.
 */
export function describe(el: Element): Described {
  return {
    tag: el.tagName.toLowerCase(),
    breadcrumb: breadcrumb(el),
    text: visibleText(el),
  };
}

/**
 * Stepping between elements, for boxes that are visually identical.
 *
 * The overlay is skipped throughout: it is a sibling of the game's content in
 * <body>, so without this, stepping through <body>'s children lands on the tool.
 */
export const nav = {
  parent(el: Element): Element | null {
    const parent = el.parentElement;
    if (!parent || parent.tagName.toLowerCase() === 'html') return null;
    return parent;
  },

  firstChild(el: Element): Element | null {
    for (const child of el.children) {
      if (!isOverlay(child)) return child;
    }
    return null;
  },

  next(el: Element): Element | null {
    let sibling = el.nextElementSibling;
    while (sibling && isOverlay(sibling)) sibling = sibling.nextElementSibling;
    return sibling;
  },

  previous(el: Element): Element | null {
    let sibling = el.previousElementSibling;
    while (sibling && isOverlay(sibling)) sibling = sibling.previousElementSibling;
    return sibling;
  },
};

/**
 * Did applying a class actually change anything?
 *
 * Brief item 99's second half, and the general property the brief says needs
 * stating: anything outside the built set fails silently unless we look. Search
 * cannot protect the raw class field or a typo, so this does.
 *
 * KNOWN LIMIT, recorded rather than solved: a class that IS in the build but
 * computes to the value already in force — or whose effect lands on a
 * descendant — reports as missing. The message is advisory and Jamie is looking
 * at the screen while he works, so item 82 says take the simple thing.
 */
export function computedSnapshot(win: Window, el: Element): string {
  return win.getComputedStyle(el).cssText;
}

export function didNothing(before: string, after: string): boolean {
  return before === after;
}
