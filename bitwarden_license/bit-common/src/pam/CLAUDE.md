# Shared PAM layer (`bitwarden_license/bit-common/src/pam`)

The half of Privileged Access Management that does not depend on the web vault. `bit-web`
consumes it today; it lives here so `bit-browser` can consume it too.

What lives here:

- `abstractions/` — the type-only contract layer (domain views, error shapes) and the
  abstract service classes the SDK implementations satisfy.
  No Angular runtime APIs in `abstractions/`, `helpers/` or `date/`'s non-pipe files, so they stay
  unit-testable without a TestBed; type-only imports of component-library option shapes (e.g.
  `SimpleDialogOptions`) are fine, since they are erased at compile time.
- `helpers/` — pure helpers and error interpretation (`pam-license-error.ts`,
  `request-access-error.ts` and the other `*-error.ts` classifiers).
- `date/` — duration and relative-time formatting, and the Angular pipes over it.
- `services/` — the SDK-backed implementations of the `abstractions/` contracts, the refresh
  services, `pam-membership.ts`, and `PamRevealedCipherService`, which both clients bind as
  Vault's `RevealedCipherService`.
- `access-state-badge/access-badge-state.ts` — the `AccessBadgeState` presentation model,
  `cipherAccessBadgeState()` and `ENDING_SOON_THRESHOLD_MS`. The badge _components_ are
  per-client and stay in their own client.
- `access-state-badge/access-badge-ticker.service.ts` — `AccessBadgeTickerService`, the shared
  clock (`ticks$`) the badges and lease-lapse re-reads run on.
- `testing/decision-builders.ts` — spec builders.

Anything Angular-component-shaped, routed, or reaching into `@bitwarden/web-vault/` is
web-specific by definition and stays in `bit-web`.

## The old client paths are shims

Every file that moved here left a one-line `export *` re-export at its old path under
`bitwarden_license/bit-web/src/app/pam/`, so `bit-web`'s relative imports still resolve.
`bit-browser` has one too: `bitwarden_license/bit-browser/src/popup/pam/access-state-badge/access-badge-ticker.service.ts`.
Edit the file here, never the shim.

`bit-web`'s `pam/index.ts` is the same arrangement one level up: it re-exports this
directory's `index.ts` wholesale and then adds the exports that stayed web-only (the audit
API and rotation). A new shared export goes in `index.ts` here and reaches `bit-web`
without a second edit.

## `export type` matters

Keep re-exports of SDK shapes type-only (`export type`). A value re-export makes jest resolve
the wasm SDK package and the suite fails to load.

## More detail

`bitwarden_license/bit-web/src/app/pam/CLAUDE.md` holds the module's rules (SDK-first, error
shape, refresh model, status spelling). Read it before changing anything here.
