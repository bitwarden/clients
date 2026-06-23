# PAM web UI (`bitwarden_license/bit-web/src/app/pam`)

The web vault's Privileged Access Management surfaces — member request flows,
the approver inbox, admin access-rule CRUD, and the governance dashboard. This is
the **commercial home** for PAM: the Angular UI, the page/gate/reloader services,
**and** the concrete `Default*` implementations (`services/`) + the cipher-lease
banner. It **consumes** `@bitwarden/bit-pam` (the commercial contract layer —
abstractions, DTOs, helpers); the domain model, state machines, API client
contract, and the `pam.allium` spec are documented in
**`bitwarden_license/bit-pam/CLAUDE.md` — read that first**.
Everything here is gated behind `FeatureFlag.Pam` (`pm-37044-pam-v-0`).

Because `apps/web` (OSS) may not import licensed code, anything OSS needs to
render PAM is reached through a seam — see **"OSS seams"** below.

## Where PAM is mounted (routing)

Both mount points are registered from **bit-web** (so they only exist in the
commercial build; Angular falls through bit-web's route trees to OSS for
non-licensed paths):

- **End-user**, in `bitwarden_license/bit-web/src/app/app-routing.module.ts`:
  - `/pam/approver-inbox` → lazy `pam/approver-inbox/approver-inbox.routes.ts`
  - `/leasing/requests/:id` → `pam/access-request-route` (email deep-link; forwards to the inbox)
  - both guarded by `canAccessFeature(FeatureFlag.Pam, true, "/vault")`.
- **Admin**, mounted at `/organizations/:orgId/pam` via bit-web's
  `admin-console/organizations/organizations-routing.module.ts` → `pam/pam-routing.module.ts`:
  - `access-rules` and `approver-inbox` → `organizationPermissionsGuard((o) => o.canManageAccessRules)`
  - `governance` → `organizationPermissionsGuard(canAccessOrgAdmin)`

The approver-inbox is a tabbed shell (`approver-inbox.component`) with routed
children **approvals / my-requests / audit-log**. The shell **provides**
`ApproverInboxService` and `MyAccessRequestsService` so all tabs share one loaded
instance and stay mounted across tab switches.

## Surfaces (components)

- **Member-facing**: `cipher-lease-badge/` + `vault-row-lease-badge/` (vault-row
  countdown / "requires approval" pills), the `cipher-lease-banner/` (injected
  into the cipher view), `my-access-requests/` (own requests + active leases;
  Start / Cancel / End-access). The user nav entry is `pam-user-nav-slot` — an
  **OSS-resident** slot in `apps/web/src/app/pam/` (see OSS seams).
- **Approver**: `approver-inbox/` — `approvals` (decide via `decide-dialog`),
  `audit-log` (managed history + own requests, with revoke / cancel-approval),
  `inbox-request-filter.ts` (drops timed-out rows), `approval-row.ts` /
  `history-row.ts` (presentation models + factories).
- **Admin**: `access-rules/` (CRUD; `access-rule-dialog`, `access-rules.service`)
  with `access-rule-editor/ip-allowlist/` (CIDR `ControlValueAccessor` +
  validators in `cidr.validator.ts`), `governance-dashboard/` (+ `kill-switch/`),
  `collection-access-rule-callout/` (shown in the collection-edit dialog via the
  `COLLECTION_ACCESS_RULE_CALLOUT` seam). The org nav group is `pam-org-nav-slot`
  — an **OSS-resident** slot in `apps/web/src/app/pam/` (see OSS seams).

> **Governance dashboard + kill switch are mock-only today.** They inject
> `GovernanceService` (a separate `@bitwarden/bit-pam` abstraction, _not_
> `PamApiService`) — `getGovernanceSummary`, `bulkRevokeLeases`,
> `unblockNewLeases`, `isLeasingFrozen`. There is no server implementation, so
> `provide-pam.ts` binds `GovernanceService` to `MockGovernanceService`
> unconditionally. The components are real but only function under that mock.

## The cipher-open → banner → reloader flow (the vault seam)

`libs/vault` never imports PAM. The integration is three injection tokens whose
implementations PAM registers in `provide-pam.ts`:

1. **`CIPHER_OPEN_GATE`** (token in `vault/individual-vault/cipher-open-gate.ts`;
   impl `cipher-open-gate.service.ts`). The vault list calls `check(cipher,
userId)` when a row is opened. Returns `"open"` (partial view — not gated, flag
   off, or no active lease), `{ kind: "openWith", cipher }` (full cipher fetched
   under an active lease), or `"handled"`. **The gate never auto-activates an
   approved request** — with no active lease it opens the partial view and lets
   the banner drive the request flow.
2. **`CIPHER_VIEW_BANNER`** (`libs/vault/src/tokens/`) = `CipherLeaseBannerComponent`,
   rendered by `cipher-view.component.ts` via `NgComponentOutlet`. The banner owns
   every inline request interaction: no lease → "Request access" (fold-out form),
   pending → "Cancel request", approved → "Start access", active → countdown +
   "Extend" / "End access".
3. **`GATED_CIPHER_RELOADER`** (`libs/vault/src/tokens/`; impl
   `gated-cipher-reloader.service.ts`). `vault-item-dialog.component.ts` subscribes
   to `fullCipher$(cipherId)`, which emits the full cipher once a lease lands and
   `null` when none — so the dialog **swaps partial → full in place** and
   **re-locks** when the lease ends. The leased cipher is never cached.

## DI wiring

`provide-pam.ts` exports `providePam(): SafeProvider[]`, imported once by the
commercial **`bit-web/app.module.ts`** (not OSS `core.module.ts` — OSS must not
reference licensed providers). It binds `PamApiService` (always the real
`DefaultPamApiService`), `AccessEventService` (real `DefaultAccessEventService`),
`GovernanceService` (always `MockGovernanceService` — no backend yet), the three
vault tokens above, `LeasedCipherFetcherService`, and the OSS-seam bindings (next
section): `PamInboxBadgeService → ApproverInboxRequestsService`,
`COLLECTION_ACCESS_RULE_CALLOUT`, `VAULT_ROW_LEASE_BADGE`.

## OSS seams (how OSS renders PAM without importing licensed code)

`apps/web` and `libs/**` can't import this directory. Five seam points let OSS
hosts surface PAM, all bound in `provide-pam.ts`:

- **Vault cipher view** — `CIPHER_OPEN_GATE` (token in apps/web),
  `CIPHER_VIEW_BANNER` + `GATED_CIPHER_RELOADER` (tokens in `libs/vault`). See the
  flow section above.
- **Nav badge** — the two nav-slot components **stay in `apps/web/src/app/pam/`**
  (org + user layouts) and inject the OSS abstraction `PamInboxBadgeService`
  (also defined in `apps/web/src/app/pam/`, since OSS consumes it), bound here to
  `ApproverInboxRequestsService.count$`.
- **Collection callout** — `COLLECTION_ACCESS_RULE_CALLOUT` (token next to the
  collection-dialog in apps/web). The dialog renders the bound component via
  `*ngComponentOutlet`; bound here to `CollectionAccessRuleCalloutComponent`.
- **Vault-row badge** — `VAULT_ROW_LEASE_BADGE` (token next to vault-items in
  apps/web). `vault-cipher-row` renders it via `*ngComponentOutlet`; bound here to
  `VaultRowLeaseBadgeComponent`.

In an OSS-only build (no bit-web) every seam is simply unprovided, so PAM is
absent and the hosts render normally.

## Service patterns to follow

- **Singleton vs page-scoped.** `ApproverInboxRequestsService` is a **root
  singleton** — the single source of pending inbox requests, multicast to nav
  badges (`count$`) and the page (`requests$`); fetch once, refresh on push /
  mutation / sync-complete. `ApproverInboxService`, `MyAccessRequestsService`, and
  `AccessRulesService` are **page-scoped** (provided at their route) and own
  projection + optimistic edits.
- **Optimistic updates with rollback.** Mutating actions remove/modify the row
  immediately, then roll back and re-throw on API failure so the component can
  toast. Re-entrancy is guarded by a `Set<id>` of in-flight ids.
- **Name resolution stays zero-knowledge.** `access-request-name-resolver.service.ts`
  fills cipher/collection names from **already-decrypted local vault state** — it
  never sends data to the server to resolve names. Only display names and
  favicon `CipherView`s flow through; no other vault data. `applyCollectionNames$`
  back-fills names reactively as vault state warms, independent of load order.
- **Live countdowns** tick a `nowMs` signal updated **outside the Angular zone**
  (the write still triggers change detection) to avoid blocking `whenStable()`.
- Components are standalone + `OnPush` + signals; observable interop via
  `toSignal()`. Dialogs use the `DIALOG_DATA` / `DialogRef` / static `.open()`
  factory pattern. Tailwind classes need the `tw-` prefix.

## Feature flag

`FeatureFlag.Pam = "pm-37044-pam-v-0"`. **Defaulted `TRUE` in this worktree
(demo) — revert to `FALSE` before merging upstream.** Components degrade silently
when the flag is off (render nothing); routes redirect to `/vault`.

## Mock layer (governance only)

`mock/mock-governance.service.ts` is the **entire** mock layer — a self-contained
`GovernanceService` implementation holding in-memory demo state (hardcoded
collections with member/pending/active counts, plus an org-wide leasing freeze;
the kill switch zeroes active leases so a reload reflects it). Governance has no
backend, so `provide-pam.ts` binds `GovernanceService` to it **unconditionally**
(no toggle, no flag) — swap in a real impl once the server lands (provider TODO).

Everything else — lease/request flows, the approver inbox, access-rule CRUD —
always runs against the real server via `PamApiService`/`DefaultPamApiService`,
and `AccessEventService` is always `DefaultAccessEventService`. There is no
broader mock store, `pam-mock` localStorage toggle, or `MockPamApiService`
anymore; the governance UI is the only thing the mock serves.

## i18n

~240 keys, prefixed `pam*` (plus a few `accessRule*`), in
`apps/web/src/locales/en/messages.json`. The UI says "access request" /
"approval", not "lease". When adding copy, follow the existing `pam`-prefix
convention; per `bitwarden_license/bit-pam/README.md` the collection-side toggle deliberately
keeps `pamLeasing*` keys while rule-shape keys are `pamAccessRule*`.
