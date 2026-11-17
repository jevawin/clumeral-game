#!/usr/bin/env node
// Expand a .dc.html artboard into plain HTML so a browser can lay it out and
// report the true content height. No dc runtime needed.
//
// Run:  node scripts/measure-artboard.mjs <in.dc.html> <out.html>
//
// Then serve the output and read it in a browser:
//
//   python3 -m http.server 8899        (from the directory holding out.html)
//
// Open it, size the viewport to 390x800 so a card fits whole, and measure with
// getBoundingClientRect. The point is to MEASURE rather than assert: label
// collisions, overhangs, leader-to-corner distances and every frame height on
// the design canvas boards were settled this way, not by eye.
//
// Why it exists: an artboard declares a fixed frame height, so the frame cannot
// tell you whether the content fits. Step 4 unpins that height, which is what
// makes the real content height readable.
//
// Scope and limits. It handles the subset of the dc format the Clumeral boards
// use and nothing more:
//   - one <script type="text/x-dc"> per board, exposing class Component with
//     renderVals(); the base class is stubbed, so renderVals must not rely on it
//   - <sc-for list="{{name}}" as="x"> with {{x.key}} holes inside
//   - scalar {{holes}} whose value is a string; a non-string is left in place
//   - a frame declared as `width: 390px; height: Npx;`
// A board that breaks any of those needs this script extended, not worked around.
//
// The committed boards are in docs/work/2026-11-01-Idea-*.dc.html; the reasoning
// behind them is in docs/work/2026-11-01-canvas-notes.md.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
const out  = process.argv[3];
let s = readFileSync(file, 'utf8');

// 1. Pull renderVals() out and run it with a stub base class.
const script = s.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const vals = new Function('DCLogic', script + '\nreturn new Component().renderVals();')(class {});

// 2. Expand every <sc-for list="{{name}}" as="x"> ... </sc-for>.
const SCFOR = /<sc-for list="\{\{(\w+)\}\}"[^>]*>([\s\S]*?)<\/sc-for>/g;
s = s.replace(SCFOR, (_, listName, body) =>
  (vals[listName] || []).map(item =>
    body.replace(/\{\{\w+\.(\w+)\}\}/g, (__, k) => item[k] ?? '')
  ).join('')
);

// 3. Fill the remaining scalar holes.
s = s.replace(/\{\{(\w+)\}\}/g, (m, k) => (typeof vals[k] === 'string' ? vals[k] : m));

// 4. Unwrap the dc shell and let the frame grow so we can read its real size.
s = s.replace(/<script src="\.\/support\.js"><\/script>/, '')
     .replace(/<\/?x-dc>/g, '')
     .replace(/<helmet>/, '').replace(/<\/helmet>/, '')
     .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
     .replace(/(width: 390px; )height: \d+px;/, '$1')
     .replace(/(<body)/, '$1 style="width:390px"');

writeFileSync(out, s);
console.log('built', out);
