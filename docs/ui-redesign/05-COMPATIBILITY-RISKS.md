# 05 — Compatibility & Risks

## Risk table

| Risk                                      | Why it threatens compatibility                    | Mitigation                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI imports core/crypto directly           | Could bypass key management or alter API payloads | UI imports only `@klappstuhl/ui-bridge`. Tags + optional Nx depConstraints enforce it; code review + this doc otherwise.                                      |
| Changing the cipher save/edit path        | Wrong payload shape breaks Vaultwarden sync       | Inline edits call the **existing** `CipherService.save` via the bridge — never hand-built API requests. No edits to `libs/common`.                            |
| Touching `desktop_native` (Rust)          | Crypto / secure-storage regressions               | Treated as black box. No source edits. CI still builds it unchanged.                                                                                          |
| Overwriting Tailwind/theme config         | Breaks upstream component styling                 | We **extend** via `fork-theme.css` imported last; we override token _values_, never token _names/APIs_, and never edit `tw-theme.css`.                        |
| Divergent renderer blocks upstream merges | The exact thing the constraints forbid            | All new code is in new `@klappstuhl/*` libs + a handful of additive edits (one theme import, two tsconfig path lines, one CI file). Periodic upstream rebase. |
| Reimplementing TOTP/clipboard             | Wrong codes / secret leakage                      | `TotpDisplay` and copy use existing `TotpService` + platform clipboard via the bridge. No new TOTP math.                                                      |
| Breaking auth/lock flows                  | Lockout or session leakage                        | Reuse existing route guards + `VaultTimeoutService`; reskin only.                                                                                             |
| Logging decrypted data                    | Secret leak (violates repo rule)                  | Never log view-model field values. Bridge maps, it does not log.                                                                                              |

## Upstream files we intentionally touch (keep this list short)

1. `apps/desktop/src/scss/tailwind.css` — one `@import` of the fork theme (last).
2. `tsconfig.base.json` — two path-alias lines for the new libs.
3. `apps/desktop/src/app/app-routing.module.ts` — one additive lazy `/redesign` route.
4. `.storybook/main.ts` — two `stories` globs for the fork's stories.
5. `package-lock.json` — registers the `@klappstuhl/*` workspaces (regenerated).
6. `.claude/CLAUDE.md` — a fork pointer section (additive).
7. _(optional)_ `eslint.config.mjs` — Nx depConstraints for `scope:fork-ui`.

Everything else is **new files only**. Restyling happens by swapping
component templates/styles in place, never by rewriting their data paths. Each
edit above is a single additive hunk, so upstream merges stay clean.

## Vaultwarden acceptance test (run before every fork release tag)

Point the client at a real Vaultwarden instance and verify, with **zero** changes
to `libs/common`:

1. Login + 2FA succeeds.
2. Full sync completes.
3. View a login, a card, an identity, and a secure note.
4. Reveal + copy a password (clipboard contains the correct value).
5. TOTP code matches an independent authenticator and counts down.
6. Edit a field and save → change persists server-side.
7. Create a new item → appears after sync.
8. Lock, then unlock.
9. On a second client, re-sync shows the change made in step 6/7.

If any step regresses, the UI has leaked into the data path — stop and fix the
bridge, do not patch core.
