# 03 — Implementation Plan (living checklist)

Status legend: `[x]` done · `[~]` in progress · `[ ]` todo. Keep this current —
it is how the next session knows where to pick up.

## A. Foundations

- [x] A1. Clone fork; verify stack (Angular 21 / Nx / Electron / webpack / electron-builder).
- [x] A2. Create `libs/ui-kit` (`@klappstuhl/ui-kit`) — package.json, project.json, tsconfig, index.
- [x] A3. Create `libs/ui-bridge` (`@klappstuhl/ui-bridge`) — package.json, project.json, tsconfig, index.
- [x] A4. Register path aliases in `tsconfig.base.json` (`@klappstuhl/ui-kit`, `@klappstuhl/ui-bridge`).
- [x] A5. Author fork theme (`ui-kit/src/theme/fork-theme.css` + `tokens.ts`) and wire it into `apps/desktop/src/scss/tailwind.css` (imported last).
- [x] A6. Toolchain installed (Node 22.12.0, npm 10.9.0, cargo 1.84, Python 3.12.10). `npm install` run at repo root — lockfile includes the `@klappstuhl/*` workspaces. **`npm run build:renderer` (production Angular AOT) passes (exit 0, no errors)** — confirms all redesign templates type-check and `fork-theme.css` loads via `tailwind.css` in the real webpack build. (Full `electron` run still needs the native module: `npm ci` *with* scripts → `electron-rebuild` + `build:main`/`build:preload`.)
- [ ] A7. (Optional) Add `lucide-angular`; verify `@angular/cdk` is resolvable.
- [ ] A8. (Optional) Add Nx depConstraints for `scope:fork-ui` in `eslint.config.mjs` (see 01-ARCHITECTURE.md).

## B. Design system

- [x] B1. First primitives built in `ui-kit/src/components/*`: `KlsButton`, `KlsCopyField`, `KlsRevealField`, `KlsTotpRing`, `KlsStrengthMeter` (standalone, OnPush, signal I/O, inline SVG icons; copy/reveal emit events — no direct clipboard). `tsc --noEmit` + `eslint` + `prettier` all pass. Remaining primitives (Input, Select, Toggle, Dialog, Tooltip, ContextMenu) still to do.
- [x] B2. Storybook wired for the fork: glob added in `.storybook/main.ts`; `redesign-shell.stories.ts` renders the full shell (run `npm run storybook` → "Fork Redesign / App Shell"). Per-primitive stories still to add.
- [x] B3. Apple-style glass pass: bumped radii (sm→8, md→14, lg→20, xl→28); deeper saturated backdrop-blur (32/40px); translucent `--fk-card-bg`/`--fk-selected-bg`/`--fk-hover-bg`; subtle `--fk-glass-border`/`--fk-glass-highlight`/`--fk-elev-glow` for frosted-panel depth; softer diffused shadows; smoother motion curves (`ease-spring`, `ease-out`, 150/250/400ms); tighter neutral ramp for gentler contrast; Inter `cv02-04,11` stylistic alternates. Components updated: sidebar (translucent blur+saturate), item-list (glass avatars, glowing selection), detail-panel (frosted card with highlight+shadow+border). Both `build-storybook` and `build:renderer` pass clean.
- [ ] B4. Sanity-check that retuned tokens propagate to existing `@bitwarden/components` (no API changes, values only).

## C. Bridge layer

- [x] C1. Implement `VaultViewModelService` (Angular @Injectable) wrapping `CipherService` → `ItemSummary`/`ItemDetail`. Maps CipherView fields (login.username/password/uris/totp, card.brand/number, identity names) reactively via `cipherViews$(userId)` observable → signal. `getDetail()` returns lazy full view; `save()` + `toggleFavorite()` delegate to `updateWithServer`. Also exposes `getTotpCode(id)` wrapping `TotpService.getCode$()`. Redesign shell consumes it live (falls back to mock data when unauthenticated in Storybook/preview).
- [ ] C2. `CopyService` (wraps platform clipboard + `TotpService`), `LockService` (wraps `VaultTimeoutService`), `FavoritesService`, `TagsService`, `SearchService`.
- [ ] C3. Unit tests for the mappers (no crypto — pure projection).

## D. Shell & navigation

- [x] D1. Preview shell built: `KlsRedesignShell` + `KlsSidebarNav` + split-pane, mounted on a NEW additive `/redesign` route (production vault untouched). Renders against mock data shaped as bridge `ItemDetail`.
- [~] D2. `KlsItemList` + rows + selection done. TODO: swap to CDK virtual scroll + hover quick-copy.
- [x] D3. `SearchBar` instant filtering via signals (`filteredItems` computed over category + query).

## E. Detail & interactions

- [x] E1. `KlsDetailPanel` split-pane built with `KlsCopyField`/`KlsRevealField`/`KlsTotpRing`/`KlsStrengthMeter` + live (mock) TOTP countdown. (Real data via bridge pending.)
- [ ] E2. Inline editing → routes through bridge `save()` (existing `CipherService.save`).
- [ ] E2. Inline editing → routes through bridge `save()` (existing `CipherService.save`).
- [ ] E3. `CommandPalette` + command registry + global hotkeys.
- [ ] E4. Recent items + Quick access panels.

## F. Polish & verify

- [ ] F1. Animations + reduced-motion; full keyboard map; CDK focus traps.
- [ ] F2. `npm run lint:fix`, `npm run prettier`, `npm run test:types`, `npm test`.
- [ ] F3. **Vaultwarden acceptance test** (see 05-COMPATIBILITY-RISKS.md) — all must pass.
- [ ] F4. Storybook / Chromatic visual review.
- [ ] F5. Tag a fork release (`vYYYY.M.P-ui`) → CI builds artifacts (see 04-CICD.md).

## Notes for the next session

- **Node is not installed in the original authoring environment.** Scaffolding,
  theme, docs, and wiring are committed as source. Steps requiring a build
  (A6, B–F) need a machine with **Node ≥ 22.12 and npm ~10**, plus **Rust** for
  `desktop_native`. Run `npm ci` at the repo root (Nx workspace install), then
  `cd apps/desktop && npm run build:renderer:dev` to smoke-test the theme.
- Work happens on a `ui-redesign` branch; rebase `main` from upstream periodically.
- When in doubt, re-read `docs/ui-redesign/README.md` golden rules.
