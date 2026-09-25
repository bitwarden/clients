# Shared PAM layer (`bitwarden_license/bit-common/src/pam`)

The half of Privileged Access Management that does not depend on the web vault. `bit-web`
consumes it today; it lives here so `bit-browser` can consume it too.

What lives here:

- `abstractions/` — the type-only contract layer (domain views, error shapes) and the
  abstract service classes the SDK implementations satisfy.
- `helpers/` — pure helpers and error interpretation (`pam-license-error.ts`,
  `request-access-error.ts` and the other `*-error.ts` classifiers).
- `date/` — duration and relative-time formatting, and the Angular pipes over it.
- `services/` — the SDK-backed implementations of the `abstractions/` contracts, the refresh
  services, the gated-cipher reloader, and `pam-membership.ts`.
- `helpers/leased-cipher.ts` — the one read of a leased cipher's full copy, shared by the web
  reloader and the popup's leased-cipher source.
- `access-state-badge/access-badge-state.ts` — the `AccessBadgeState` presentation model,
  `cipherAccessBadgeState()` and `ENDING_SOON_THRESHOLD_MS`. The badge _components_ are
  per-client and stay in their own client.
- `access-state-badge/access-badge-ticker.service.ts` — the one shared 1-second clock. Both
  clients' old paths are shims.
- `testing/decision-builders.ts` — spec builders.

Anything Angular-component-shaped, routed, or reaching into `@bitwarden/web-vault/` is
web-specific by definition and stays in `bit-web`.

## The old `bit-web` paths are shims

Every file that moved here left a one-line `export *` re-export at its old path under
`bitwarden_license/bit-web/src/app/pam/`, so `bit-web`'s relative imports still resolve.
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
