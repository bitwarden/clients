# PAM — OSS nav slots only (`apps/web/src/app/pam`)

PAM is a commercial feature; almost all of it lives in
**`bitwarden_license/bit-web/src/app/pam/`** (read that `CLAUDE.md`), with the
framework-agnostic contracts in **`@bitwarden/pam`** (`libs/pam`, read that one
first).

This OSS directory keeps only the two **navigation slot** components — the one
PAM surface the OSS web shell must render itself, since `apps/web` may not import
licensed code:

- `org-nav-slot/` — the admin-console org side-nav PAM group.
- `user-nav-slot/` — the user-layout approver-inbox entry.

Both are gated by `FeatureFlag.Pam`, link to static `pam/...` routes (registered
by bit-web, so they only resolve in the commercial build), and read the inbox
badge count from the **`PamInboxBadgeService`** abstraction (`@bitwarden/pam`),
injected `{ optional: true }`. bit-web binds that abstraction to
`ApproverInboxRequestsService`; in an OSS-only build it's unprovided and the
badge falls back to `0`.

The other OSS render seams for PAM (component-injection tokens) live next to
their hosts, not here:

- `COLLECTION_ACCESS_RULE_CALLOUT` — `admin-console/.../collection-dialog/`.
- `VAULT_ROW_LEASE_BADGE` — `vault/components/vault-items/`.
- `CIPHER_OPEN_GATE` — `vault/individual-vault/` (plus `CIPHER_VIEW_BANNER` /
  `GATED_CIPHER_RELOADER` in `libs/vault`).
