// Clumeral edit mode — the class list, the colour predicate and the family map.
//
// NODE-SIDE ONLY. Imported by vite.config.ts and by tests, never by the browser
// and never by any module under src/ that the game imports. See the plan's
// module layout for why that separation is the whole safety story.
//
// Everything here comes from Tailwind's own design system rather than a
// hand-written list, so the classes edit mode offers cannot drift from the
// classes @theme actually defines (brief items 43, 44).

import { __unstable__loadDesignSystem, compile } from '@tailwindcss/node';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STYLESHEET = resolve(REPO_ROOT, 'src/tailwind.css');

/** What `getClassList()` returns: the name, and Tailwind's metadata for it. */
export type ClassEntry = [name: string, meta: { modifiers: string[] }];

/** class name -> the CSS properties it declares, sorted. See buildFamilyMap. */
export type FamilyMap = Map<string, string[]>;

/**
 * The six component classes.
 *
 * Plain CSS rules in src/tailwind.css, not Tailwind utilities, so the design
 * system does not know them and getClassList() cannot return them. Elements
 * using these cannot be retuned with utilities alone, and an edit to one is a
 * signal to the bot that the change belongs in the stylesheet.
 *
 * Listed by hand rather than converted to @utility (brief item 110): converting
 * would edit the file that produces the PRODUCTION stylesheet, which brief item
 * 55 forbids. Six strings in a dev-only module touch nothing that ships.
 */
export const COMPONENT_CLASSES = [
  'digit-box', 'burger-btn', 'skip-link', 'toast-msg', 'warn', 'recurring',
] as const;

/**
 * Named-scale shadows, kept despite classifying as colour.
 *
 * Tailwind's shadow utilities accept an opacity modifier, so isColourUtility
 * would drop every one of them — including the project's own tokens. Jamie,
 * 2026-08-19: the game's look leans on these and losing them is a worse trade
 * than the bytes. Measured cost: 3,188 bytes, 0.26% of the sheet.
 *
 * Named scale ONLY. The 909 colour-named shadows (shadow-accent,
 * shadow-red-500, …) are not exempted — they are the explosion the "no colours"
 * rule exists to avoid.
 */
export const SHADOW_EXEMPTIONS = [
  'shadow-2xs', 'shadow-xs', 'shadow-sm', 'shadow-md',
  'shadow-lg', 'shadow-xl', 'shadow-2xl',
  'shadow-box', 'shadow-box-active', 'shadow-key',
] as const;

const EXEMPT = new Set<string>(SHADOW_EXEMPTIONS);

/**
 * Every class the design system knows about — 23,031 of them on this build.
 *
 * Marked unstable by Tailwind, and it is the one real dependency risk in Stage
 * A. It is the same API Tailwind's own IntelliSense and Prettier plugin use, it
 * has survived every 4.x release, and the fallback if it ever goes is the
 * spike's route A (hand-written `@source inline(...)`).
 *
 * Async, and `base` is required — without it the call throws while resolving
 * the nested `tailwindcss/*` imports.
 */
export async function loadClassList(): Promise<ClassEntry[]> {
  const ds = await __unstable__loadDesignSystem(readFileSync(STYLESHEET, 'utf-8'), {
    base: REPO_ROOT,
  });
  return ds.getClassList() as ClassEntry[];
}

/**
 * Is this utility a colour?
 *
 * Tailwind does not label them, but it does say which utilities take an OPACITY
 * modifier, and those are exactly the ones whose value is a colour. That is the
 * brief's item 43 mechanism: classify from Tailwind's own data so the split
 * cannot drift from the catalogue.
 *
 * The word "numeric" is load-bearing. `modifiers.length > 0` alone is wrong —
 * text-sm carries line-height modifiers (tight, snug, normal, …) and would be
 * misread as a colour, dropping the entire text-size scale from the stylesheet.
 *
 *   text-sm       ["tight","snug","normal","relaxed","loose"]  -> not a colour
 *   text-text     ["0","5","10", … ,"100"]                     -> a colour
 *   border-2      []                                           -> not a colour
 */
export function isColourUtility([name, meta]: ClassEntry): boolean {
  if (EXEMPT.has(name)) return false;
  const mods = meta?.modifiers;
  if (!Array.isArray(mods) || mods.length === 0) return false;
  return mods.every((m) => /^\d+$/.test(m));
}

/** Every class name, colours included — the "everything" set for the A3 gate. */
export function allClasses(list: ClassEntry[]): string[] {
  return list.map(([name]) => name);
}

/** The default set: everything that is not a colour, plus the exempted shadows. */
export function nonColourClasses(list: ClassEntry[]): string[] {
  return list.filter((entry) => !isColourUtility(entry)).map(([name]) => name);
}

/**
 * Which CSS properties does each class declare?
 *
 * This is the family map, and it is the answer to the question Tailwind's own
 * data cannot settle. ClassMetadata carries modifiers and nothing else, so
 * there is no family field to read — and the obvious prefix rule is WRONG:
 * text-sm, text-center and text-2xl all share the prefix `text`, so a prefix map
 * silently deletes a font size when you centre the text.
 *
 * A utility's family is the set of properties it declares, read from the
 * compiled output. Two classes collide when those sets are exactly equal:
 *
 *   mt-4   margin-top                  p-4    padding
 *   mt-6   margin-top          same    px-6   padding-inline      different
 *
 * Which gives brief item 40's ruling for free — `p-4 px-6` keeps both, because
 * Tailwind emits the shorthand first and the pair already means "6 inline, 4
 * block" — rather than as a hand-written special case that can rot.
 *
 * Tailwind's internal --tw-* custom properties are dropped: they appear across
 * unrelated families and would make everything look like everything else.
 */
export async function buildFamilyMap(classes: string[]): Promise<FamilyMap> {
  const compiler = await compile(readFileSync(STYLESHEET, 'utf-8'), {
    base: REPO_ROOT,
    onDependency() {},
  });
  return parseFamilies(compiler.build(classes));
}

/** Split out from buildFamilyMap so the parsing can be tested without a compile. */
export function parseFamilies(css: string): FamilyMap {
  const map: FamilyMap = new Map();
  // Innermost `.class { … }` blocks. A class can emit more than one rule, so
  // properties accumulate rather than overwrite.
  for (const rule of css.matchAll(/\.((?:\\.|[\w-])+)\s*\{([^{}]*)\}/g)) {
    const name = rule[1].replace(/\\/g, '');
    const props = [...rule[2].matchAll(/([-\w]+)\s*:/g)]
      .map((m) => m[1])
      .filter((p) => !p.startsWith('--tw'));
    const existing = map.get(name) ?? new Set<string>();
    props.forEach((p) => existing.add(p));
    map.set(name, existing as unknown as string[]);
  }
  // Freeze to sorted arrays so comparison is a plain string compare.
  const out: FamilyMap = new Map();
  for (const [name, props] of map) {
    out.set(name, [...(props as unknown as Set<string>)].sort());
  }
  return out;
}

/**
 * Do these two classes fight over the same declarations?
 *
 * Exact set equality, deliberately — not subset. border-2 declares
 * {border-style, border-width} and border-solid declares {border-style}; under a
 * subset rule adding border-solid would eat border-2. Under equality both stay,
 * CSS settles border-style to the same value either way, and nothing is lost.
 * Brief item 42: record what Jamie did, do not be clever on his behalf.
 *
 * A class absent from the map (not in this build) never collides — brief item 99
 * is what tells him it did nothing.
 */
export function sameFamily(map: FamilyMap, a: string, b: string): boolean {
  const pa = map.get(a);
  const pb = map.get(b);
  if (!pa || !pb || pa.length === 0 || pb.length === 0) return false;
  return pa.length === pb.length && pa.every((p, i) => p === pb[i]);
}

/** Where the generated artefacts live. Gitignored — see .gitignore and A1. */
export const ARTEFACT_DIR = resolve(REPO_ROOT, '.edit-mode');
//
// The two class lists live in SEPARATE SUBDIRECTORIES, and that is not tidiness.
// An explicit `@source` at a file registers its whole DIRECTORY as a scan root,
// so with both lists side by side the non-colour stylesheet swept up the
// all-colours list next to it and compiled all 23,031 classes - 5.24 MB where
// 1.16 MiB was intended. Observed on the dev server, 2026-08-20; the spike did
// not hit it because it only ever generated one list. One list per directory.
export const ARTEFACTS = {
  'non-colour': resolve(ARTEFACT_DIR, 'non-colour/classlist.txt'),
  all: resolve(ARTEFACT_DIR, 'all/classlist.txt'),
  families: resolve(ARTEFACT_DIR, 'families.json'),
} as const;

/**
 * Generate both class lists and the family map. Called when the dev server
 * starts.
 *
 * Never committed (brief item 59): a committed 386 kB file of class names is
 * issue #312's failure mode at full volume, with every class in the project
 * landing in the production stylesheet.
 */
export async function writeArtefacts(): Promise<{ nonColour: number; all: number }> {
  const list = await loadClassList();
  const nonColour = nonColourClasses(list);
  const all = allClasses(list);

  mkdirSync(resolve(ARTEFACT_DIR, 'non-colour'), { recursive: true });
  mkdirSync(resolve(ARTEFACT_DIR, 'all'), { recursive: true });
  writeFileSync(ARTEFACTS['non-colour'], [...nonColour, ...COMPONENT_CLASSES].join('\n'));
  writeFileSync(ARTEFACTS.all, [...all, ...COMPONENT_CLASSES].join('\n'));

  const families = await buildFamilyMap(nonColour);
  writeFileSync(ARTEFACTS.families, JSON.stringify(Object.fromEntries(families)));

  return { nonColour: nonColour.length, all: all.length };
}
