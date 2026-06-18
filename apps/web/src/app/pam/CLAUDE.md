# PAM web UI (`apps/web/src/app/pam`)

The web vault's Privileged Access Management surfaces — member request flows,
the approver inbox, admin access-rule CRUD, and the governance dashboard. This is
the **consumer** of `@bitwarden/pam`; the domain model, state machines, API
client, and the `pam.allium` spec are documented in **`libs/pam/CLAUDE.md` — read
that first**. Everything here is gated behind `FeatureFlag.Pam`
(`pm-37044-pam-v-0`).

## Where PAM is mounted (routing)

Two mount points:

- **End-user**, in `apps/web/src/app/oss-routing.module.ts`:
  - `/pam/approver-inbox` → lazy `approver-inbox/approver-inbox.routes.ts`
  - `/leasing/requests/:id` → `access-request-route` (email deep-link; forwards to the inbox)
  - both guarded by `canAccessFeature(FeatureFlag.Pam, true, "/vault")`.
- **Admin**, mounted at `/organizations/:orgId/pam` via
  `organization-routing.module.ts` → `pam-routing.module.ts`:
  - `access-rules` and `approver-inbox` → `organizationPermissionsGuard((o) => o.canManageAccessRules)`
  - `governance` → `organizationPermissionsGuard(canAccessOrgAdmin)`

The approver-inbox is a tabbed shell (`approver-inbox.component`) with routed
children **approvals / my-requests / audit-log**. The shell **provides**
`ApproverInboxService` and `MyAccessRequestsService` so all tabs share one loaded
instance and stay mounted across tab switches.

## Surfaces (components)

- **Member-facing**: `cipher-lease-badge/` + `vault-row-lease-badge/` (vault-row
  countdown / "requires approval" pills), the cipher-lease banner (in
  `@bitwarden/pam`, injected into the cipher view), `my-access-requests/` (own
  requests + active leases; Start / Cancel / End-access), `pam-user-nav-slot`.
- **Approver**: `approver-inbox/` — `approvals` (decide via `decide-dialog`),
  `audit-log` (managed history + own requests, with revoke / cancel-approval),
  `inbox-request-filter.ts` (drops timed-out rows), `approval-row.ts` /
  `history-row.ts` (presentation models + factories).
- **Admin**: `access-rules/` (CRUD; `access-rule-dialog`, `access-rules.service`)
  with `access-rule-editor/ip-allowlist/` (CIDR `ControlValueAccessor` +
  validators in `cidr.validator.ts`), `governance-dashboard/` (+ `kill-switch/`),
  `collection-access-rule-callout/` (shown in the collection-edit dialog),
  `pam-org-nav-slot`.

> **Governance dashboard + kill switch are mock-only today.** Their API methods
> (`getGovernanceSummary`, `bulkRevokeLeases`, `unblockNewLeases`,
> `isLeasingFrozen`) `Promise.reject` in `DefaultPamApiService` (see
> `libs/pam/CLAUDE.md`). The components are real but only function under the mock.

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

`provide-pam.ts` exports `providePam(): SafeProvider[]`, imported once by
`core.module.ts`. It binds `PamApiService` + `AccessEventService` (real or mock,
chosen at factory time), the three vault tokens above, and
`LeasedCipherFetcherService`.

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

## Mock layer (demo scaffolding)

Enabled by `localStorage.setItem("pam-mock", "true")` — `provide-pam.ts` checks
`PamMockConfig.isEnabled()` at DI factory time and swaps in `MockPamApiService` +
`MockAccessEventService`. `pam-mock-store.ts` is an in-memory state machine
(auto-decides after a delay, ~20% auto-deny, lazy expiry sweep, simulates the
freeze / kill switch); `mock-access-event.service.ts` bridges store events into
the push stream. The mock is the only way to exercise governance / kill-switch
today.

## i18n

~240 keys, prefixed `pam*` (plus a few `accessRule*`), in
`apps/web/src/locales/en/messages.json`. The UI says "access request" /
"approval", not "lease". When adding copy, follow the existing `pam`-prefix
convention; per `libs/pam/README.md` the collection-side toggle deliberately
keeps `pamLeasing*` keys while rule-shape keys are `pamAccessRule*`.
