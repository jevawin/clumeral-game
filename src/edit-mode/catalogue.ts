// Clumeral edit mode — the catalogue and search.
//
// BROWSER SIDE. Nothing in the game imports this file, and nothing in this file
// imports the game (brief item 60). Pure: it takes the generated class list and
// family map as arguments rather than fetching them, so it is testable without a
// server and without a 2-second Tailwind compile.
//
// The catalogue is a CLOSED SET. It is built from the same generated list the
// dev stylesheet compiled, so search can only ever offer a class the browser can
// actually apply. Offering anything else produces the failure brief item 38
// exists to prevent — a chip that is tapped and nothing moves — by a different
// door (brief items 98, 99).

/** class name -> the CSS properties it declares. Generated; see edit-mode/classlist.ts. */
export type FamilyMap = Record<string, string[]>;

export interface Catalogue {
  /** Every class this build can apply. */
  readonly classes: string[];
  /** Is this class in the built stylesheet? */
  has(name: string): boolean;
  /** What does this class declare? Undefined for the component classes. */
  properties(name: string): string[] | undefined;
}

export interface SearchGroup {
  /** What this group of classes does, in CSS terms. */
  family: string;
  /** The matches shown, already capped. */
  matches: string[];
  /** How many matched in total, capped or not — so nothing looks missing. */
  total: number;
}

export interface SearchOptions {
  /** Most matches to show per family. */
  perFamily?: number;
  /** Most families to show. */
  maxFamilies?: number;
}

/**
 * Defaults sized for a phone.
 *
 * `mt` yields about 15 and is fine uncapped; `bg` and `text` run to hundreds
 * across colour x shade, and are unusable without a cap. Grouping alone does not
 * save it — one family can be the whole problem.
 */
const DEFAULTS = { perFamily: 12, maxFamilies: 8 } as const;

/** The label for classes the design system knows no properties for. */
const COMPONENT_FAMILY = 'component class';

/**
 * A family's name, for the search UI.
 *
 * The properties themselves, rather than a made-up category name. `text-` covers
 * font size, alignment and colour; showing "font-size, line-height" against
 * "text-align" tells Jamie exactly why those two do not replace each other,
 * which is the same rule the overlay applies when it decides whether to swap a
 * class (see families.ts).
 */
export function familyLabel(properties: string[] | undefined): string {
  if (!properties || properties.length === 0) return COMPONENT_FAMILY;
  return properties.join(', ');
}

export function createCatalogue(classes: string[], families: FamilyMap): Catalogue {
  const set = new Set(classes);
  return {
    classes: [...classes],
    has: (name) => set.has(name),
    properties: (name) => families[name],
  };
}

/**
 * The part of a class name that search matches against.
 *
 * Two rules from brief item 35, both about making a short query find the obvious
 * thing:
 *
 *   - Match the segment after the LAST colon, so `mt` finds `md:mt-4`. No
 *     variant is offered today (item 98), but the rule belongs with the rest of
 *     the matching logic rather than being bolted on the day one is.
 *   - Strip a leading minus, so `mt` finds `-mt-4`. Without it the negative half
 *     of every scale is invisible unless you think to type the minus.
 */
function matchable(name: string): string {
  const afterVariant = name.slice(name.lastIndexOf(':') + 1);
  return afterVariant.startsWith('-') ? afterVariant.slice(1) : afterVariant;
}

/**
 * Prefix search, grouped by family and capped.
 *
 * Prefix only, deliberately: `t-7` cannot reach `mt-7`. It keeps result sets
 * small and predictable, and it means a query narrows as you type rather than
 * jumping around.
 *
 * An empty query returns nothing rather than everything — 23,031 results is not
 * a useful answer to "I have not typed anything yet".
 */
export function search(
  catalogue: Catalogue,
  query: string,
  options: SearchOptions = {}
): SearchGroup[] {
  const { perFamily, maxFamilies } = { ...DEFAULTS, ...options };

  const needle = matchable(query.trim().toLowerCase());
  if (needle.length === 0) return [];

  const byFamily = new Map<string, string[]>();
  for (const name of catalogue.classes) {
    if (!matchable(name.toLowerCase()).startsWith(needle)) continue;
    const label = familyLabel(catalogue.properties(name));
    const bucket = byFamily.get(label);
    if (bucket) bucket.push(name);
    else byFamily.set(label, [name]);
  }

  return [...byFamily.entries()]
    // Most-populated family first: typing `text` should show the size scale
    // before the one-off alignment utilities.
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxFamilies)
    .map(([family, matches]) => ({
      family,
      matches: matches.slice(0, perFamily),
      // The true count, not the shown count. A capped group that reported 12
      // would read as "that is all there is", and the edge of the scale is
      // information Jamie is meant to act on (brief item 72).
      total: matches.length,
    }));
}
