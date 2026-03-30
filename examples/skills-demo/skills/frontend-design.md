---
name: frontend-design
description: Design and render beautiful UI components — payment cards, dashboards, stat grids, forms — using Tailwind CSS via the render_ui tool
strategy: auto
version: 1.0.0
---

This skill guides creation of distinctive, production-grade UI components rendered via the `render_ui` tool. Avoid generic aesthetics. Every component should have a clear visual identity.

## Output Format

Always use the `render_ui` tool with `type: "html"` for UI components.
- Tailwind CSS (Play CDN) is pre-loaded in the iframe — use any utility class freely
- Chart.js is also available for embedded charts
- Set `height` to fit the content: `"240px"` for cards, `"500px"` for dashboards

## Design Thinking

Before generating, commit to a BOLD aesthetic direction:
- **Tone**: Pick an extreme — luxury/refined, brutally minimal, glassmorphism, editorial, retro-futuristic, art deco. Never default to generic.
- **Typography**: Use Google Fonts via `<link>` tag. Distinctive choices only — no Inter, Roboto, or Arial.
- **Color**: Dominant background with sharp accent. Dark, rich palettes outperform washed-out light themes for cards and dashboards.
- **Details**: Grain overlays, gradient meshes, subtle borders, layered shadows — atmosphere beats flatness.

## Component Guidance

### Payment Cards
- Deep, rich background: navy, dark slate, charcoal, or gradient (never plain white)
- Chip icon (SVG or CSS), masked card number `•••• •••• •••• 4242`, cardholder name, expiry
- Network logo area (VISA / Mastercard wordmark in text is fine)
- Glassmorphism with `backdrop-filter: blur` works well
- Add subtle noise texture via SVG `feTurbulence` filter or CSS `background-image`
- Height: ~220–260px

### Dashboards
- Dark base (`#0a0d14` or similar), grid of stat cards + chart
- Stat cards: metric label (uppercase, muted), large mono value, colored delta badge
- Use Chart.js inline for any charts
- Height: 480–600px

### Stat Grids
- 3–4 column grid, each card: icon, value, label, trend
- Subtle borders, hover lift effect with CSS transition
- Height: ~180–200px

### Forms / Auth Screens
- Single-column centered layout, generous padding
- Input fields with clear focus rings, matching aesthetic
- Height: ~380–440px

## Style Rules

NEVER use: Inter, Roboto, Arial, system-ui as primary fonts. NEVER use purple gradients on white. NEVER produce cookie-cutter shadcn defaults without a distinct personality on top.

DO use: unexpected font pairings, asymmetric layouts, deliberate negative space, micro-animations via CSS `@keyframes`, decorative borders, and color that feels intentional.

Every component should be something the user would screenshot and share.
