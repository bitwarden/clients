# 03 — Implementation Plan (living checklist)

Status legend: `[x]` done · `[~]` in progress · `[ ]` todo. Keep this current —
it is how the next session knows where to pick up.

## A. Foundations
- [x] A1. Clone fork; verify stack (Angular 21 / Nx / Electron / webpack / electron-builder).
- [x] A2. Create `libs/ui-kit` (`@klappstuhl/ui-kit`) — package.json, project.json, tsconfig, index.
- [x] A3. Create `libs/ui-bridge` (`@klappstuhl/ui-bridge`) — package.json, project.json, tsconfig, index.
- [x] A4. Register path aliases in `tsconfig.base.json` (`@klappstuhl/ui-kit`, `@klappstuhl/ui-bridge`).
- [x] A5. Author fork theme (`ui-kit/src/theme/fork-theme.css` + `tokens.ts`) and wire it into `apps/desktop/src/scss/tailwind.css` (imported last).
- [ ] A6. `npm ci` at repo root on a machine with Node ≥22.12 (NOT installed in the authoring env); confirm webpack renderer build picks up the new import. (Verification step — see note at bottom.)
- [ ] A7. (Optional) Add `lucide-angular`; verify `@angular/cdk` is resolvable.
- [ ] A8. (Optional) Add Nx depConstraints for `scope:fork-ui` in `eslint.config.mjs` (see 01-ARCHITECTURE.md).

## B. Design system
- [ ] B1. Build primitives in `ui-kit/src/components/*` (Button → StrengthMeter, CopyField, RevealField, TotpRing) as standalone Angular components.
- [ ] B2. Storybook stories for each (Storybook already configured at repo root).
- [ ] B3. Sanity-check that retuned tokens propagate to existing `@bitwarden/components` (no API changes, values only).

## C. Bridge layer
- [ ] C1. Implement `VaultViewModelService` (Angular @Injectable) wrapping `CipherService` → `ItemSummary`/`ItemDetail` (contract already in `ui-bridge/src/vault/vault-view-model.ts`).
- [ ] C2. `CopyService` (wraps platform clipboard + `TotpService`), `LockService` (wraps `VaultTimeoutService`), `FavoritesService`, `TagsService`, `SearchService`.
- [ ] C3. Unit tests for the mappers (no crypto — pure projection).

## D. Shell & navigation
- [ ] D1. `AppShell` + `SidebarNav`; mount inside existing routes/guards (no route path changes).
- [ ] D2. `ItemList` (CDK virtual scroll) + `ItemRow` + hover quick-copy.
- [ ] D3. `SearchBar` instant filtering over the bridge signal.

## E. Detail & interactions
- [ ] E1. Split-pane `DetailPanel`; per-type sections; `CopyField`/`RevealField`/`TotpDisplay`.
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
