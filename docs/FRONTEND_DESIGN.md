# FRONTEND_DESIGN.md — emmy Design System

> The visual and copy rules for the EMMY frontend.
> **Read this before touching anything in `frontend/`.** Any new screen, component, or copy string must follow these rules, so the product keeps one voice and one look no matter which agent or developer builds it.

**Last updated:** 2026-07-25
**Reference implementation:** `frontend/src/index.css` (tokens), `frontend/src/App.css` (components), `frontend/src/Login.jsx`, `frontend/src/Chatbot.jsx`, `frontend/src/Markdown.jsx` (reply rendering), `frontend/src/Reminders.jsx`, `frontend/src/Motivation.jsx` + `frontend/src/Profile.jsx` (study tool panes)

---

## 1. Design direction (the one-liner)

**Sleek white.** The interface should feel like a clean desk: white cards on a faint green-grey ground, one deep emerald accent for every action, and a warm serif wordmark so the product feels human, not clinical.

Approved by the project owner on 2026-07-16. Do not change the direction (dark theme, new accent color, gradients, UI library) without explicit approval from the owner.

---

## 2. Color tokens

All colors are CSS custom properties defined once in `frontend/src/index.css`. **Never hardcode hex values in components or new CSS — use the tokens.**

| Token | Value | Use |
|-------|-------|-----|
| `--em-ground` | `#F5F6F4` | Page/app background (faint green-grey, not pure grey) |
| `--em-paper` | `#FFFFFF` | Cards, sidebar, bubbles, inputs — anything that "sits on" the ground |
| `--em-ink` | `#171B18` | Primary text (green-biased near-black, never pure `#000`) |
| `--em-muted` | `#68706B` | Secondary text |
| `--em-faint` | `#9AA29C` | Placeholders, disabled states, tertiary labels |
| `--em-line` | `#E4E8E4` | All borders and dividers |
| `--em-accent` | `#1E6E53` | THE accent: primary buttons, active states, links |
| `--em-accent-deep` | `#14523D` | Accent hover + accent-colored text (better contrast) |
| `--em-tint` | `#E9F2ED` | Mint tint: user chat bubbles, active sidebar item, success notices |
| `--em-danger` | `#A33B2E` | Error text |
| `--em-danger-tint` | `#F8ECEA` | Error backgrounds |

Rules:
- **One accent.** Emerald is the only action color. Do not introduce blue, purple, or gradients.
- **No color emoji in the UI chrome.** Icons are monochrome text glyphs (`◆ ◇ ◷ ▤ ✎ ☺`) so they inherit `currentColor` and go emerald with their row. A color emoji ignores the token system entirely: `⏰` and `📄` were replaced on 2026-07-25 because a red clock sat directly against the mint `.sb-item.active` background. Characters like `⏰` and `📄` have emoji presentation by default and are always colored, so pick from the geometric shapes and dingbat blocks instead.
- **Semantic colors are not accents.** Danger red/amber may only signal errors or due dates, never decoration.
- Every surface is white or a token tint. No shadows heavier than the existing card shadow.

---

## 3. Typography

Three roles, defined as tokens in `index.css`:

| Token | Stack | Role |
|-------|-------|------|
| `--em-serif` | Georgia, "Times New Roman", serif | **Display only:** the `emmy.` wordmark (always lowercase, italic, with an emerald `.`), emmy's avatar "e", large screen greetings, and the word of the day term (`.word-term`, added 2026-07-25) |
| `--em-sans` | "Segoe UI", -apple-system, … | Everything else: body, buttons, inputs |
| `--em-mono` | ui-monospace, Consolas, … | Tiny uppercase labels (sidebar section headers, status line), data |

Rules:
- The wordmark is always `emmy` + `<span class="dot">.</span>` inside a `.wordmark` element. Never "EMMY" in the UI, never a logo image.
- Do not add webfonts (Google Fonts etc.). The system stacks are the design.
  - **One exception, owner-approved 2026-07-16: KaTeX's maths fonts** (§5.1). They ship inside the `katex` package and are bundled locally by the build — no CDN, works offline. They typeset *maths content only* and never appear in UI chrome. Maths genuinely needs a maths font: system stacks have no proper italic variables, stretchy delimiters or big operators. This exception does not open the door to other webfonts.
- Uppercase mono labels get letter-spacing (see `.sb-label`); body text never does.
- Serif marks **the one display moment on a screen**, never body copy. A pane gets at most one. `.word-term` qualifies because the term *is* the content of that pane. It stays lowercase: uppercasing a vocabulary word would show the student a spelling they should not copy, the same reasoning as the KaTeX rule in §5.2.

---

## 4. Voice and copy

emmy is a supportive study buddy, not a system. Copy is design material — follow these rules for every user-facing string:

- **Plain language, active voice.** "Sign in", not "Submit credentials".
- **Errors say what happened and what to do**, without apologizing or blaming: "That email and password don't match — try again?"
- **No em-dashes in emmy's chat voice.** The welcome message, canned lines, and error lines emmy "says" use commas or full stops instead of em-dashes (—). This is an explicit owner preference (2026-07-16). Example: "Hi Demo! I'm emmy, your study buddy." The rule is also written into `SYSTEM_PROMPT` in `backend/app.py`, so it covers her generated replies too.
- Buttons state exactly what happens: "Create account", "Send", "Log out".
- emmy refers to herself in first person, lowercase name.

emmy's **generated** replies are governed by `SYSTEM_PROMPT` in `backend/app.py`. That prompt is the copy spec for everything she says: keep it in sync with this section, and only ask her for formatting the renderer below can draw.

---

## 5. Component conventions

All component styles live in `frontend/src/App.css` under section comments. Reuse existing classes before writing new ones:

| Pattern | Class(es) | Notes |
|---------|-----------|-------|
| Primary action | `.btn-primary`, `.btn-send` | Emerald fill, white text, disabled = `--em-faint` |
| Secondary action | `.btn-new`, `.cta`-style outline | White with `--em-line` border, hover turns emerald |
| Text link action | `.link-btn` | Underlined, `--em-accent-deep` |
| Card | `.login-card`, `.tool-card`-style | White, 1px `--em-line` border, 12–16px radius |
| Form field | `.field` (label + input) | Uppercase 12px label, 8px-radius input, emerald focus ring |
| Inline feedback | `.form-error`, `.form-notice` | Tinted background, no icons, no alert() ever |
| Chat bubble (emmy) | `.msg .bubble` | White, bordered, top-left corner squared |
| Chat bubble (user) | `.msg.user .bubble` | Mint tint, borderless, top-right corner squared |
| Rendered reply | `.prose` (+ `.code-block`) | emmy's Markdown — see §5.1 |
| Maths | `.math-display`, `.math-inline` | KaTeX output — see §5.2 |
| Sidebar item | `.sb-item` (+ `.active`) | Active = mint background + `--em-accent-deep` |
| "Not built yet" | `.soon` pill | Mark unimplemented nav instead of hiding or faking it |
| Study tool pane | `.tool-main` + `.tool-scroll` | Replaces `.chat-main` in the shell; see §5.3 |
| Pane card | `.tool-card` | White card holding a form or a group; same border and radius as `.login-card` |
| Pane section label | `.tool-label` | The mono micro-label from §3, same language as `.sb-label` |
| Pane action | `.btn-tool` | Emerald, but left-aligned and content-width, not full-width like `.btn-primary` |
| Empty / loading line | `.tool-empty` | Plain muted sentence. Never a spinner-only screen |
| Word of the day | `.word-card` (`.word-term`, `.word-meaning`, `.word-example`) | Serif term, plain meaning, example quoted behind a mint rule |

### 5.1 emmy's replies are Markdown

emmy answers in Markdown, and `frontend/src/Markdown.jsx` renders it inside her bubble (`<Markdown text={…} />` wrapped in `.prose`). User messages and error bubbles stay plain text — never render user input as Markdown.

- **Hand-rolled, on purpose.** No `react-markdown` or similar: §7 keeps this project dependency-light. Extend `Markdown.jsx` instead. (Maths is the one thing we don't hand-roll — see below.)
- **The renderer and the prompt are one contract.** It draws paragraphs, nested lists, `###` headings, bold/italic, inline + fenced code, links, quotes, rules and LaTeX maths. It does **not** draw tables — and `SYSTEM_PROMPT` tells emmy not to write them. Change both sides together, or neither.
- **Reply headings are micro-labels.** `###` renders as the mono uppercase label from §3 in `--em-accent-deep`, the same language as the sidebar's "CHATS". No serif inside a bubble.
- Emerald appears only on list markers, headings and links. Prose stays `--em-ink`.
- Links open in a new tab and only when the URL is `http(s):` or `mailto:` — anything else falls back to plain text. Keep that check if you touch link rendering.

### 5.2 Maths is typeset, never printed

Maths is a core use case for a study app, so emmy writes LaTeX (`$...$` inline, `$$...$$` display) and **KaTeX** typesets it. `SYSTEM_PROMPT` forbids ASCII maths (`x^2`, `sqrt(x)`, `+/-`) and forbids maths in code blocks — a formula in a grey monospace box is a bug, not a formula.

- `katex` is an **approved dependency exception** (§7) and its fonts an approved webfont exception (§3), both from the owner on 2026-07-16.
- Display maths sits in a `.math-display` card on the ground colour, left-aligned with the prose rather than KaTeX-centred, and scrolls horizontally when an equation is too wide. Inside a list item or quote it drops the card and just sits inline with the step.
- **Never let `text-transform` reach a formula.** The `.prose h3` micro-label is uppercased, and `$x^2$` uppercased to `X²` is a *different variable*. `.prose h3 .katex` resets it; the prompt also asks emmy to keep maths out of headings. Same care applies to any new uppercased surface.
- If a formula won't parse, `Markdown.jsx` shows the LaTeX source in a `.math-raw` code span rather than KaTeX's red error text. A student can still read `\frac{a}{b}`; a red error in the middle of a thread just looks broken.
- KaTeX runs with `trust: false` (its default), which blocks `\href` and raw HTML from the model's output. Keep it that way — that's what makes injecting its HTML safe.

Interaction states are mandatory, not optional polish:
- Async actions **disable their trigger** while in flight (`sending`/`busy` state) and show progress (typing indicator `.typing-bubble`, or button text like "One moment…").
- Every focusable element keeps a visible focus ring (`:focus-visible` is styled globally — don't remove outlines).
- Respect `prefers-reduced-motion` for any new animation (see the typing dots for the pattern).

### 5.3 Study tool panes

Reminders and Profile are **panes inside the chat shell**, not separate pages. `Chatbot.jsx` holds a `view` state (`chat` / `reminders` / `profile`) and swaps what sits next to the sidebar. Build Notes, Quizzes and Feedback the same way:

- The sidebar never moves or hides. A pane is reached from an `.sb-item`, which takes `.active` exactly like a chat does. One `view` at a time, so `.active` must be false on the chats when a tool pane is open.
- A pane is `.tool-main` (the frame `.chat-main` uses) + the existing `.chat-head` bar + a `.tool-scroll` body. Reusing `.chat-head` is what makes a pane feel like part of the app rather than a bolted-on screen. Its right-hand `.status` slot takes a quiet fact, not a decoration: the reminder count, the student's email.
- `.tool-scroll` caps at 680px, the same reading-measure idea as `.msg` (§6). A form stretched across a wide monitor is tiring to fill in.
- Forms reuse `.field` from the login card, so labels, inputs, selects and focus rings match everywhere. Add a `.field-hint` under a control when the student cannot otherwise tell what it will do.
- **Say what a control actually does.** The profile language hint says emmy still switches when the student writes in another language, because a "preferred language" field that silently loses to the message would read as broken.
- Mutations are optimistic: tick, delete and reorder apply straight away, and a failed request puts the old state back and explains itself in a `.form-error`. Losing a student's reminder to a dropped network is worse than a slower click.
- A pane always says something. Loading, empty and error each get a `.tool-empty` or `.form-error` line in emmy's voice ("No reminders yet. Add the first one above…"), never a blank panel.

---

## 6. Layout rules

- The chat shell is a two-column grid (`.chat-app`): 260px white sidebar + ground-colored main. Under 720px the sidebar hides (mobile nav is a future task — don't improvise one).
- Message rows cap at `min(78%, 76ch)`. The `ch` half is a reading-measure limit, not decoration: without it, a structured reply runs 150+ characters per line on a wide monitor. Keep any new long-form surface on a similar measure.
- Login/register is one centered card (`.login-stage`) with a single mode-flip, not separate pages/routes.
- Spacing comes from flex/grid `gap`, not stacked margins.
- New screens (Reminders, Notes, Quizzes) follow the "Study tools" concept in the approved proposal: cards on the ground color inside the same shell. See §5.3 for the built pattern, and the proposal artifact below.

---

## 7. Engineering constraints

- **No UI libraries.** No Tailwind, MUI, Bootstrap, styled-components. Plain CSS in `index.css`/`App.css` on the existing CRA setup. This is also why Markdown rendering is hand-rolled (§5.1).
- **One dependency exception: `katex`** (§5.2), approved by the owner on 2026-07-16. Reason: a study app must show real formulas, and LaTeX layout is not something to hand-roll. Cost: +76 kB gz JS, +4 kB CSS, plus bundled fonts. Its stylesheet is imported by `Markdown.jsx`, the one place vendor CSS is allowed. Any further dependency needs the same explicit conversation.
- Functional React components + hooks, matching `Login.jsx` / `Chatbot.jsx` style.
- API base is `http://127.0.0.1:5000` (the `API` const) — keep it a single constant per file until env config is introduced.
- Frontend tests: `src/App.test.js` renders the login screen and the register flip. Keep them passing (`npm test -- --watchAll=false`); mock `axios` in tests.

---

## 8. Reference

- **Approved UI proposal (interactive mockups + rationale):** https://claude.ai/code/artifact/4ac3fecd-1a5b-4f00-b5cc-f8acf9669e9b
- The proposal's "Study tools" screen is the blueprint for F15–F17 UIs when their endpoints land.

When a design decision here changes, update this file and log it in `docs/DEVLOG.md`, same as any other project-memory change.
