# PAM web UI (`bitwarden_license/bit-web/src/app/pam`)

Commercial home for Privileged Access Management: the access-rules admin UI, the
requester's leasing flow, and the approver's inbox. Gated behind `FeatureFlag.Pam`
(`pm-37044-pam-v-0`).

## Surfaces

- `abstractions/` / `helpers/` / `date/` — framework-agnostic contract layer: domain
  types and error helpers (`abstractions/access-rule.ts`, `abstractions/access-lease.ts`),
  the abstract service contracts, and pure helpers. Re-exported via `index.ts`. No
  Angular APIs here; keep it that way so this stays unit-testable without a TestBed.
  Was its own package (`@bitwarden/bit-pam`) — folded in here since `bit-web` was its
  only consumer.
- `access-rules/` — list (`access-rules.component` + `.service`) and the routed
  create/edit page (`access-rule-edit.component`), at `access-rules`,
  `access-rules/new`, `access-rules/:accessRuleId`.
- `access-rules/access-rule-edit/ip-allowlist/` — the `ip_allowlist` condition's CIDR
  editor plus its validators (delegates to the SDK's `is_valid_cidr`). The editor is a
  thin view over a `FormArray` owned by the edit page's form group (passed in via a
  `cidrArray` input): the array-level validators live on the host control so validity
  flows through the parent form, and the page disables the array while the condition is
  off. Per-row CIDR validation rides on each pushed control.
- `access-requests/` — the user-scoped "Access requests" page at `/pam`: a tabbed shell
  (`access-requests.component`) over Approvals, My requests, and History, plus the
  shareable single-request page at `/pam/requests/:id`. `MyAccessService`,
  `ApproverInboxService`, and `AccessNameResolverService` are provided on the SHELL
  ROUTE, not on the component, because routed children inherit a parent route's
  providers but not a component's — that is what lets the tabs share one load.
- `approvals/` — the approver side: the SDK-backed inbox data service, the decide
  dialog, the privilege check, and the route guard.
- `cipher-view-banner/` — the requester's entry point on an open gated cipher: four
  states off `cipher_access_state()`, with an inline request form.
- `access-state-badge/`, `vault-row-lease-badge/` — the one access-state pill, and the
  vault-row host that renders it.
- `collection-access-rule-callout/` — names the rules governing a collection, inside the
  collection edit dialog.
- `services/` — the SDK-backed implementations of the `abstractions/` contracts.
- `testing/` — builders shared across specs (`decision-builders.ts`).

## SDK-first, no exceptions

Every PAM call goes through the Rust SDK (`client.commercial().pam()`), never HTTP.
`AccessRuleSdkService`, `AccessRequestSdkService`, `AccessLeaseSdkService`, and
`ApprovalSdkService` are the abstract contracts; `services/*-sdk.service.ts` compose the
SDK client. `ApprovalSdkService` (`services/approvals-sdk.service.ts`) covers the
approver-facing surface — the pending inbox, the decided history, and recording a
decision — via `commercial().pam().approvals()`; this used to be a raw-HTTP exception
while the SDK lacked that surface, but the SDK now exposes it and the exception is gone.

**If a PAM capability turns out to be missing from the SDK, that is SDK work — not a
raw-HTTP route.** Approver-side revoke and cancel-approval go through the SDK
(`leases().end()`, `access_requests().cancel()`) for the same reason.

## Error shape

`abstractions/access-rule.ts` defines `AccessRuleError` — a flat, hand-written shape
(`{ name: "AccessRuleError", variant, message }`) mirroring the SDK's wasm-bindgen error
convention. Use `accessRuleErrorMessage()` / `isAccessRuleNotFound()` to interpret it;
never treat it as `ErrorResponse`. Lease/request calls throw the SDK's `LeasingError`,
detected through the injectable `LeasingErrorService` seam so consumers never import the
wasm guard.

A rejected access-request submit is interpreted by
`helpers/request-access-error.ts`. Three of the server's messages mean the caller already
has what they asked for; those are reconciled (collapse the form, re-read the state) rather
than surfaced as errors.

## `export type` matters

`abstractions/access-rule.ts` and `abstractions/access-lease.ts` re-export SDK shapes
using `export type` (not `export`) — type-only and erased at compile time, so jest never
resolves the wasm SDK package when running this directory's unit tests. Keep new
re-exports of SDK shapes type-only for the same reason.

## Status spelling follows the SDK

`canceled`, one L — in code, in i18n keys (`pamStatusCanceled`), everywhere. The SDK's
`AccessLeaseStatus` has no `cancelled` value at all: a holder ending their own lease and
an operator revoking it are both `revoked`, and `historyDisplayStatus` tells them apart
from the decision log instead — the SDK now carries `endedByHolder` on `AccessLeaseView`,
which makes that heuristic unnecessary; adopting it is tracked separately. The SDK's own
`TryFrom` conversions normalise incoming wire values onto these spellings, so the module
never sees the other form.

## Refresh model

`cipher_access_state()` and the list reads are one-shot, so nothing re-reads on its own.
Two services drive every refresh:

- `AccessEventService` — the server's `RefreshAccessRequest` push, filtered to a bare tick.
- `AccessRefreshService` — merges that push with this client's own mutations and fans it
  out per cipher, so the cipher-view banner and the gated-cipher reloader react to a local
  change and a remote one through exactly the same path.

Page-level services (`MyAccessService`, `ApproverInboxService`,
`AccessRequestDetailService`) subscribe to the push directly and reload. Use `concatMap`,
not `switchMap`: two pushes arriving together must not interleave their loads and leave
several subjects describing different moments.

## OSS seams

PAM reaches non-commercial code only through injection tokens, each injected
`{ optional: true }` on the OSS side so an unprovided token is inert. `provide-pam.ts`
binds them all: `CIPHER_VIEW_BANNER`, `GATED_CIPHER_RELOADER` (both `libs/vault`),
`VAULT_ROW_LEASE_BADGE`, `COLLECTION_ACCESS_RULE_CALLOUT`, `PamNavBadgeService`, and
`VaultRowAccessActionsService` (the vault-row menu's cancel-request entry; all `apps/web`).
Add a seam rather than importing PAM from OSS code.

## Routing and DI

`pam-routing.module.ts` (admin console) guards every route with
`canAccessFeature(FeatureFlag.Pam)`; `access-rules` additionally requires
`organizationPermissionsGuard((org) => org.canManageAccessRules)`.
`access-requests/access-requests-routing.module.ts` (user-scoped) additionally guards the
`approvals` tab with `canViewApprovalsGuard`, which redirects a non-approver to
`my-requests` rather than blocking. Mounting these modules and calling `providePam()` from
`app.module.ts` happen elsewhere.
