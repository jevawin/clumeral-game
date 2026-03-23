# Clumeral

**Work out the number from 100-999. New puzzle every day.**

[clumeral.com](https://clumeral.com)

Clumeral is a daily browser puzzle game. A seeded random algorithm filters numbers 100-999 down to one answer using mathematical clues about each digit. Every player gets the same puzzle each day.

## How it works

Each puzzle gives you clues about a hidden 3-digit number. Clues are based on properties of the digits - whether they're prime, square, triangular, or Fibonacci numbers, plus sums, differences, products, means, and ranges of digit pairs. You read the clues, narrow down the possibilities, and guess the number.

## Tech stack

No framework, no bundler, no build step. Pure HTML, CSS, and JavaScript.

| File | Purpose |
|------|---------|
| `index.html` | Game shell |
| `app.js` | Client UI - renders clues, handles guesses, manages game state |
| `puzzle.js` | Shared puzzle logic - properties, filter algorithm, seeded RNG |
| `_worker.js` | Cloudflare Pages Worker - injects puzzle data server-side |
| `style.css` | All styling - light/dark themes, responsive layout |

### Puzzle generation

- Candidates start as all integers 100-999
- Each digit has properties derived on-the-fly (prime, square, cube, triangular, etc.)
- A seeded RNG (mulberry32) draws filters from 6 property groups per loop iteration
- A tiebreaker phase sweeps exact-match filters until one candidate remains
- Same date seed = same puzzle for everyone

### Themes

Light and dark themes via CSS `light-dark()`. The coral accent (`#ff6d5a`) runs throughout - operators, borders, buttons, tags.

## Getting started

```bash
# Clone
git clone https://github.com/jevawin/clumeral-game.git
cd clumeral-game

# Enable git hooks (blocks commits on main)
git config core.hooksPath .githooks

# Start dev server
python3 -m http.server 8080
# Open http://localhost:8080
```

In local dev, the app skips the Cloudflare Worker and generates the puzzle directly in the browser using `puzzle.js`.

## Git workflow

`main` is protected - never commit or push to it directly.

```
issue/NUM  -->  dev  -->  PR  -->  main
(feature)    (integrate)       (deploy)
```

- **Features / bug fixes**: branch `issue/NUM` from `dev`, build there, merge into `dev`
- **Cleanup / config / docs**: commit directly to `dev`
- **Deploy**: PR from `dev` to `main`, merge when ready

Multiple issue branches can be batched into a single PR.

## Deployment

Push to `main` triggers auto-deploy via Cloudflare Pages. The `_worker.js` is picked up automatically by Pages Advanced Mode - no `wrangler.toml` needed.

## Contributing

Issues and ideas tracked on [GitHub Issues](https://github.com/jevawin/clumeral-game/issues) with the `roadmap` label.

## Trademark

"Clumeral" is a trademark of Jamie Evawin. The MIT License grants rights to the source code, not to the Clumeral name, branding, or visual identity. You're welcome to use the code to build your own thing — just don't call it Clumeral.

## License

[MIT](LICENSE) - see LICENSE file for details.
