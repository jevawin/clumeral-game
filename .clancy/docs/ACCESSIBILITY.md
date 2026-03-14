# Accessibility

## WCAG Level

**Partial WCAG 2.1 Level AA compliance.** This is a simple daily puzzle game with minimal complexity. Accessibility features are implemented where they meaningfully impact gameplay, but the project prioritizes core game mechanics over comprehensive WCAG conformance.

**What is implemented:**
- Sufficient color contrast (text on backgrounds meets AA standards)
- Semantic HTML5 (headings, lists, form elements)
- Keyboard navigation for core game flow
- Basic ARIA labels and roles

**What is not implemented:**
- Comprehensive ARIA live regions
- Extended focus management
- Color-blindness testing/alternative indicators
- Screen reader comprehensive testing
- Complex modal or dialog patterns

## ARIA Patterns

Limited ARIA usage focused on essential game elements:

### Save Toggle Checkbox
```html
<button class="save-toggle" id="save-toggle" 
        role="checkbox" 
        aria-checked="true|false" 
        aria-label="Keep my score in a cookie">
```
- **Role:** `checkbox` (button styled as checkbox)
- **aria-checked:** Dynamically updated by JavaScript to reflect state
- **aria-label:** Descriptive text for screen readers
- **Behavior:** Updated in `app.js` `updateCheckbox()` function

### Decorative Icons
```html
<svg ... aria-hidden="true">...</svg>  <!-- Heart animation in footer -->
<svg ... aria-label="Claude">...</svg> <!-- Brand logos in footer -->
```
- **aria-hidden:** Decorative elements (bouncing heart) are hidden from screen readers
- **aria-label:** Functional brand icons labeled for identification

### Form Input
```html
<input id="guess" type="text" inputmode="numeric" 
       maxlength="3" placeholder="Enter a 3-digit number">
```
- **Semantic:** Native `<input>` element (not custom)
- **placeholder:** User instruction text
- **inputmode:** Mobile keyboard hint (numeric)
- **maxlength:** Enforced constraint

### Submit Button
```html
<button id="submit">Submit</button>
```
- **Semantic:** Native `<button>` element
- **Disabled state:** CSS `disabled` attribute and JavaScript enforcement
- **Focus:** Visible focus ring with accent color

## Keyboard Navigation

**Fully keyboard accessible for core gameplay.**

### Input Focus
- Input field auto-focuses after puzzle loads: `guessEl.focus()` in `startDailyPuzzle()`
- Focus ring visible on `#guess:focus` with 2px accent-colored shadow

### Submit Methods
- **Click:** Visible submit button
- **Enter key:** Listeners attached to input and button
  ```js
  document.getElementById("guess").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleGuess();
  });
  document.getElementById("submit").addEventListener("click", handleGuess);
  ```

### Toggle Checkbox (Save Score)
- **Click:** `.save-toggle` button is fully clickable
- **No keyboard shortcut:** Toggle must be clicked; no Tab order issue since it comes after input (Tab naturally reaches it)

### Navigation Flow
1. Page loads → input auto-focuses
2. User types 3-digit number or Tab through fields
3. Enter key or Tab+Space on button submits guess
4. After guess → input re-focuses: `document.getElementById("guess").focus()`
5. After puzzle solved → input disabled, footer links remain keyboard accessible

### Tab Order
- **Initial:** Input field (auto-focused)
- **Second:** Submit button
- **Third:** Save toggle checkbox
- **Fourth onward:** Footer links
- **Natural source order** (no tabindex manipulation)

## Focus Management

**Automatic focus handling, minimal management.**

### Initial Focus
- `startDailyPuzzle()` calls `guessEl.focus()` to set input as initial focus target
- Happens after puzzle data loads

### Focus During Gameplay
- After incorrect guess: `document.getElementById("guess").focus()` (returns to input for next try)
- Input value cleared: `document.getElementById("guess").value = ""` (ready for new input)

### Focus After Completion
- Input disabled: `guessEl.setAttribute("disabled", "")`
- Submit disabled: `submitEl.setAttribute("disabled", "")`
- No focus trap; user can Tab to footer links
- No programmatic focus movement to announcement (feedback message is visible text)

### No Focus Trap
- Game card does not trap focus
- Footer remains Tab-accessible after puzzle solved

## Screen Reader Support

**Minimal but functional for core gameplay.**

### What Screen Readers Hear
1. **Page load:**
   - "Clumeral" (h1 title)
   - "Crack the three-digit number. New puzzle every day." (tagline)
   - "Puzzle #N — date" (label with details)

2. **Clue list:**
   - List of semantic `<li>` elements with natural text content
   - Boolean clues: "The first digit is a prime number" (semantic <strong> emphasis)
   - Numeric clues: "The sum of ... ≤ **5**" (operators and values in <strong> tags)

3. **Input section:**
   - "Edit text, Enter a 3-digit number" (input with placeholder)
   - "Submit button" (native button)

4. **Feedback:**
   - Text content of feedback div read naturally
   - ".feedback--correct" state is visual only (text content speaks for itself)
   - ".feedback--incorrect" state is visual only

5. **Save toggle:**
   - "Keep my score in a cookie, checkbox, checked" (aria-label + role + aria-checked)
   - State updates read as "unchecked" or "checked" when toggled

6. **Stats section (if shown):**
   - "Your stats" heading
   - Stats values and labels (Played: N, Avg tries: X)
   - Bubble numbers read as plain text

7. **Next puzzle message:**
   - "Come back tomorrow for Puzzle #N" (plain text)

8. **Footer:**
   - "Vibe-coded with Claude, hosted on Cloudflare, sourced on GitHub"
   - Links are identified and visitable: "Jamie and Dave" link to LinkedIn

### What Screen Readers Do NOT Get
- **Icon decorations:** aria-hidden on heart; no functional loss
- **Operator symbols:** Visible as ≤, ≥, =, ≠; text fallbacks exist in code (`OPERATOR_SYMBOLS` object)
- **Color-based feedback:** Green/red indicators are visual only; text content (e.g., "Incorrect") communicates meaning

### No Live Regions
- Feedback messages are visible text that users will read
- History updates via DOM replacement, not announced dynamically
- Stats appear via display toggle with no aria-live

## Limitations & Future Considerations

1. **Color contrast:** Muted text (#7a7a9a on #0f0f1a) is borderline AA; may fail some contrast tests
2. **Operator symbols:** Non-ASCII (≤, ≥, ≠) may not be read reliably by all screen readers
3. **No custom focus indicators beyond color:** Could add more visual distinction (e.g., outline style variation)
4. **No high-contrast mode:** Dark theme only; no light/inverted option for low-vision users
5. **Stats bubbles:** Simple numbers with no additional context (could be enhanced with labels)

## Testing Recommendations

- Verify with NVDA (Windows) or JAWS for screen reader compatibility
- Test keyboard-only navigation on desktop and mobile
- Check color contrast in WCAG Color Contrast Checker
- Test with browser DevTools accessibility tree inspector
- Validate with axe DevTools or similar

