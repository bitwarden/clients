# 02 — Design System

## How theming works (the merge-safe reskin mechanism)

Upstream defines tokens as CSS custom properties under `:root`, `.theme_light`,
`.theme_dark` in `libs/components/src/tw-theme.css`. Tailwind utilities consume
them via `rgb(var(--color-*) / <alpha-value>)`.

We **never edit that file**. Instead:

1. `libs/ui-kit/src/theme/fork-theme.css` re-declares the same variable names with
   our values, plus our own `--fk-*` tokens.
2. `apps/desktop/src/scss/tailwind.css` imports it **after** the upstream theme.
   Later declaration + equal specificity wins → the whole app reskins with zero
   logic changes and zero merge conflicts.

> Legacy color vars are **space-separated RGB triplets** (e.g. `13 15 18`) because
> they are wrapped in `rgb(var(--x) / <alpha>)`. Keep that format. Newer
> "Figma palette" tokens are hex.

**To retune the look:** edit values in `fork-theme.css` only.

## Tokens

`fork-theme.css` is the rendered source of truth; `tokens.ts` mirrors the scales
for use in component logic.

- **Spacing (4px base):** 1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 10=40 ·
  12=48 · 16=64 → `--fk-space-*`.
- **Radii:** sm=6 · md=10 · lg=14 · xl=20 · full → `--fk-radius-*`.
- **Depth:** `--fk-blur-chrome` (20px), `--fk-blur-overlay` (28px), elevation
  shadows `--fk-elev-xs|sm|md|panel`.
- **Motion:** `--fk-ease`, `--fk-dur-fast|base|slow` (zeroed under
  `prefers-reduced-motion`).
- **Type:** display 28/700 · h1 22/600 · h2 18/600 · body 14/450 · label 13/500 ·
  caption 12/450 · mono 13. Font: Inter (sans) / JetBrains Mono (passwords/TOTP).
- **Color (dark, primary):** app `#0D0F12`, panels `#15181C`, indigo accent
  (`--color-primary-500` = `109 140 248`), text `233 236 240` / muted
  `148 158 173`. Status colors softened for dark comfort. Translucent
  `--fk-sidebar-bg` / `--fk-overlay-bg` drive the blur/depth.
- **Light:** polished, not inverted — soft off-white surfaces, deeper indigo.

## Component inventory

**Primitives — `@klappstuhl/ui-kit` (Angular standalone, Storybook stories):**
Button, IconButton, Input, Textarea, Select, Toggle, Badge/Tag, Tooltip, Avatar,
Skeleton, Toast, Dialog/Sheet, ContextMenu, ProgressRing (TOTP), StrengthMeter,
CopyField, RevealField.

**App composites — `apps/desktop/src/app/`:**

- `AppShell` — sidebar + content grid, Electron drag region, mac traffic-light
  padding.
- `SidebarNav` — All items · Logins · Cards · Identities · Secure notes ·
  Favorites · Tags (Tags list is dynamic, from the bridge).
- `CommandPalette` — Cmd/Ctrl+K overlay (CDK Overlay + command registry service).
  Actions: navigate, create item, copy username/password/TOTP, lock vault, search.
- `ItemList` (CDK virtual scroll) + `ItemRow` (icon, title, subtitle, favorite,
  hover quick-copy).
- `SearchBar` — instant client-side filtering (debounced signal over the bridge's
  decrypted list).
- `DetailPanel` — split-pane right side; per-cipher-type sections; inline editing;
  `CopyField` + `RevealField` (blurred-until-reveal); `TotpDisplay` (code + ring).
- `QuickAccess` / `RecentItems` panels.

## Layout

```
┌──────────────┬───────────────────────┬──────────────────────────┐
│  SidebarNav  │   ItemList (virtual)  │      DetailPanel         │
│  (blur bg)   │  ┌ SearchBar ─────┐   │  title / fields          │
│  All items   │  │ instant filter │   │  CopyField + RevealField │
│  Logins …    │  └────────────────┘   │  TotpDisplay (ring)      │
│  Favorites   │  ItemRow (hover copy) │  inline edit             │
│  Tags ▸      │                       │                          │
└──────────────┴───────────────────────┴──────────────────────────┘
        Cmd/Ctrl+K → CommandPalette overlay (app-wide)
```

**Motion:** Angular animations for list↔detail crossfade/slide; respect
`prefers-reduced-motion`.

**Keyboard map:** `↑/↓` move · `Enter` open · `⌘C`/`Ctrl+C` copy password ·
`⌘⇧C` copy username · `/` focus search · `⌘K`/`Ctrl+K` palette · `Esc` close.
Focus traps via CDK A11y.
