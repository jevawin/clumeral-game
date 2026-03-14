# Design System

## Token System (CSS Custom Properties)

All tokens defined in `:root`:

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg-deep` | `#0f0f1a` | Main background color (near-black) |
| `--bg-card` | `rgba(255, 255, 255, 0.06)` | Frosted glass card background (must be rgba for blur effect) |
| `--accent` | `#ff6d5a` | Coral — operator symbols, clue borders, button backgrounds, links |
| `--accent-alt` | `#ff914d` | Orange hover state for buttons and links |
| `--text` | `#e8e8f0` | Primary text color (light gray) |
| `--text-muted` | `#7a7a9a` | Secondary text, labels, status messages |
| `--green` | `#4caf88` | Positive feedback (correct guess), checked checkbox icon |
| `--red` | `#ff6d5a` | Negative feedback (incorrect guess) — same as `--accent` |

## Component Library

No external UI framework. All components built with semantic HTML and CSS.

### Card (`.card`)
- **Purpose:** Main game shell container
- **Styling:** Frosted glass effect with `backdrop-filter: blur(12px)` and `-webkit-backdrop-filter` (Safari support)
- **Layout:** Flex column with 1rem gap
- **Dimensions:** `min(480px, 90vw)` width, responsive padding
- **Border:** 1px solid `rgba(255, 255, 255, 0.1)`

### Clue Rows (`.clue-row`)
- **Purpose:** Individual puzzle clue display
- **Styling:** 3px left border in accent color, 0.95rem font, 1.4 line-height
- **Operator Span (`.clue-op`):** Accent-colored operators (≤, ≥, =, ≠)
- **Bold Text:** Boolean predicates and numeric values emphasized with `<strong>`

### Input Row (`.input-row`)
- **Purpose:** Guess input and submit button container
- **Layout:** Flex row on desktop (gap: 0.5rem), stacks full-width on mobile (max-width: 480px)
- **Input Field (#guess):** 
  - Flex 1 (expands to fill)
  - `inputmode="numeric"` for mobile keyboards
  - `maxlength="3"` enforced
  - Focus ring: 2px shadow with accent color at 25% opacity
  - Disabled state: 40% opacity, cursor not-allowed
- **Submit Button (#submit):**
  - Accent background with white text
  - Hover state: transitions to `--accent-alt`
  - Disabled state: 40% opacity, cursor not-allowed
  - Font weight 500, 0.15s ease transition

### Feedback Message (`.feedback`)
- **Purpose:** Display guess correctness and puzzle completion
- **Styling:** Min height 1.4rem to prevent layout shift
- **States:**
  - `.feedback--correct`: Green text
  - `.feedback--incorrect`: Red text

### History Section
- **Label (#history-label):** Uppercase, muted, 0.8rem, 0.05em letter-spacing
- **List (#history):** Flex wrap, 0.4rem gap
- **Items (.history-item):** Muted text, 0.9rem, right-padded flex layout

### Save Toggle (`.save-toggle`)
- **Purpose:** Checkbox for score persistence preference
- **Styling:** Icon button (no border, no background), accent color
- **Checked State:** Changes to green color
- **Icons:** Inline SVGs swapped via display property (one shown, one hidden)
- **ARIA:** `role="checkbox"`, `aria-checked="true|false"`, `aria-label`

### Stats Section (`.stats`)
- **Purpose:** Gameplay history visualization
- **Layout:** Border-top separator, flex column
- **Heading (.stats-heading):** Uppercase, 0.7rem, 0.08em letter-spacing
- **Grid (.stats-grid):** Flex row, 1.5rem gap
- **Stats Item (.stats-item):** Flex column, centered, gap 0.1rem
- **Stats Value (.stats-val):** Large (1.5rem), bold, line-height 1
- **Stats Bubbles (.stats-bubble):** 2rem circles, accent border, accent text, 0.85rem font

### Footer (`.site-footer`)
- **Purpose:** Credits and links
- **Layout:** Flex column, centered
- **Font:** Forum (serif), 1rem, white
- **Row (.footer-row):** Flex row, centered, compact gap (0.175rem or 0.35rem)
- **Icons (.footer-icon):** 16x16px, flex-shrink: 0
- **Links (.footer-link):** Accent color with bottom border, hover transitions to `--accent-alt`
- **Heart Animation:** Bounces 3px every 1.6s

### Title & Instructions (Outside Card)
- **Title (.game-title):** Forum serif, 2.25rem on mobile / 3rem on desktop, white, bold
- **Instructions (.game-instructions):** Forum serif, 1.5rem on mobile / 2rem on desktop, white, max-width 480px

## Theming

**Dark theme only.** No light mode variant.

- **Background:** Radial gradient from `#1a1a2e` at top to `#0f0f1a` (near-black) — creates subtle depth
- **Card:** Semi-transparent white (6% opacity) with blur creates frosted glass over gradient
- **Accent color:** High-contrast coral (#ff6d5a) for interactive elements, operators, and feedback
- **Text:** Light gray (#e8e8f0) on dark background for readability
- **Muted text:** Dimmed (#7a7a9a) for secondary information
- **Feedback:** Green for success, red/accent for errors
- **Safari compatibility:** Both prefixed `-webkit-backdrop-filter` and standard `backdrop-filter` required for frosted glass effect

## Responsive Breakpoints

**Single breakpoint: 480px**

### Mobile (max-width: 480px)
- Input row stacks vertically (input and button each 100% width)
- Card width: `min(480px, 90vw)` (respects narrower screens)
- Body padding: 1.5rem
- Titles scale down: 2.25rem (title), 1.5rem (instructions)

### Desktop (min-width: 481px)
- Input row stays inline (flex row with 0.5rem gap)
- Titles scale up: 3rem (title), 2rem (instructions)
- Card width: fixed 480px (constrained by `min()`)

## Icon System

All icons are inline SVG elements. No icon font or separate icon library.

### Icon Usage
- **Checkbox icons:** Two SVGs with `display` toggled (one shown at a time)
  - `.icon-checked`: Checkmark in box (checked state)
  - `.icon-unchecked`: Empty box (unchecked state)
- **Footer logos:** Three brand icons (Claude, Cloudflare, GitHub) at 16x16px
  - Claude: Custom path fill (#CC9B7A)
  - Cloudflare: Custom path fill (#F6821F)
  - GitHub: Fill (white via text color inheritance)
- **Heart animation:** Animated footer heart bounces with CSS keyframe every 1.6s
  - Color: #c60200 (deep red)
  - Animation: translateY(-3px) at 50%

### Icon Accessibility
- **Decorative:** Icons with `aria-hidden="true"` (heart animation)
- **Functional:** Icons with `aria-label` for screen readers (brand logos in footer)
- **Interactive:** Checkbox icons styled with `currentColor` to inherit button color state

