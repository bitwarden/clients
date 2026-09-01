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
- `access-rules/access-rule-edit/rule-bypassable-ciphers-callout/` — warns that the rule is not
  actually protecting some of the credentials it governs, and names the collections letting them
  through. Gating is a union (a cipher is withheld only when EVERY collection reaching it gates), so
  an item also sitting in an ordinary collection is not protected at all. The determination is the
  SERVER's — `listBypassGaps`, the exact negation of `CipherLeaseGate.IsGated` — and it returns
  COLLECTION ids, nothing about the ciphers. That asymmetry is the design, not an omission: a cipher
  name can only be decrypted from the caller's own vault, and an admin outside the collection —
  precisely the admin being warned — has none of those ciphers there, so a cipher list is blank for
  the person who needs it. Collection names come from
  `CollectionAdminService.collectionAdminViews$`, the org-scoped admin read, which returns EVERY
  collection to a caller authorized for `ReadAllWithAccess` (Admin/Owner, i.e. anyone who can reach
  this page) — so a gap names itself regardless of assignment. Do NOT "improve" this by adding a
  cipher list or count; that was tried and removed. A non-empty gap list IS the warning condition, so
  there is no separate flag to keep in step. Each gap links to
  `/organizations/{orgId}/vault?collectionId=<id>`; an admin with no access to that collection gets
  the `collection-access-restricted` empty state, whose "Edit collection" button opens the very dialog
  they need, and a gap whose name will not resolve still renders as a link. Reflects the SAVED rule,
  not the collections multi-select's current value. The read is kicked off from `afterNextRender`,
  NOT reactively off the inputs: starting it during initial change detection keeps the zone unstable
  through first paint, and `AutofocusDirective` takes its deferred `onStable` path and loses the
  rename flow's focus-and-select on the name field — guarded by "selects the prefilled name so typing
  replaces it" in `access-rule-edit.component.spec.ts`. The component declares NO providers of its
  own, deliberately: a component-level provider wins over the module injector and would defeat the
  stubs its stories and spec install.
- `access-rules/access-rule-edit/ip-allowlist/` — the `ip_allowlist` condition's CIDR
  editor plus its validators (delegates to the SDK's `is_valid_cidr`). The editor is a
  thin view over a `FormArray` owned by the edit page's form group (passed in via a
  `cidrArray` input): the array-level validators live on the host control so validity
  flows through the parent form, and the page disables the array while the condition is
  off. Per-row CIDR validation rides on each pushed control.
- `access-requests/` — the user-scoped "Access requests" page at `/pam`: a tabbed shell
  (`access-requests.component`) over Approvals, My requests, and History, plus the
  shareable single request at `/pam/requests/:id`. `MyAccessService`,
  `ApproverInboxService`, and `AccessNameResolverService` are provided on the SHELL
  ROUTE, not on the component, because routed children inherit a parent route's
  providers but not a component's — that is what lets the tabs share one load.
- `access-requests/access-request-route/` — `/pam/requests/:id`. A real route, not a
  click handler, because the rows link to it and the planned `EmailApprovalDeepLink`
  lands on it; but a DIALOG over the shell rather than a page of its own. It is a
  fourth child of the shell route, so the header and tab bar stay mounted;
  `access-request-route.component` is the host (opens the dialog, renders the tab the
  caller came from behind it, and on close REPLACES the URL with `/pam/<that tab>`, so a
  dismissed dialog is never left addressable and never stacked on top of), and
  `access-request-dialog.component` is the view. `originTab` picks that tab off the
  previous navigation's URL, matched on the whole `/pam/<tab>` shape, so an approver
  opening a row keeps the Approvals inbox behind the dialog rather than watching it swap
  to their own requests; My requests is only the fallback, for a caller from outside the
  tabs or a cold load. Do not step the browser back on close instead: the router's
  `previousNavigation` says only that this SPA session navigated before, never that the
  browser has an entry below this one to go back to.
  `AccessRequestDetailService` is provided on the host component, not the route config,
  because it reads the `:id` off `ActivatedRoute` — a route-level provider resolves in
  the route's environment injector, where that lookup falls through to the root route.
  The host hands the service to the dialog through `DIALOG_DATA` for the same reason:
  `DialogService` builds the dialog's injector from the root one.
- `approvals/` — the approver side: the SDK-backed inbox data service, the decide
  dialog, the privilege check, and the route guard.
- `cipher-view-banner/` — the requester's entry point on an open gated cipher: four
  states off `cipher_access_state()`, with an inline request form.
- `vault-filter-gated-collection/` — the lock glyph beside a governed collection in the
  vault's Filters sidebar. Reads the same server-derived `hasEnabledAccessRule` the
  collection-row badge does, off the sidebar's own collection node.
  `VaultFilterService.buildCollectionTree` rebuilds each node through
  `new CollectionView(...)`, which resets that flag to `false` — so it is carried over
  onto the copy explicitly, rather than re-deriving "governed" from a `listAccessRules`
  read. That read required organization membership, which a provider browsing a client
  org's Admin Console does not have, so it used to fail closed to unmarked there; reading
  the flag instead works identically for members and providers, and in both the
  individual vault and the Admin Console org sidebar (the same
  `VaultFilterSectionComponent` hosts it in both).
- `gated-collection-banner/` — the notice above the vault's item list while a governed
  collection is the active filter, carrying the sidebar lock's sentence verbatim. It
  cannot read the flag the way the sidebar lock and the collection-row badge do, because
  it is handed ids alone, never a collection: it decides "governed" through
  `services/gated-collection.ts`, which wraps the same `GovernedCollectionsService` /
  `rulesGoverningCollection` pair the collection dialog uses, and narrows to the
  collection's own PAM-enabled organization before reading at all. A new surface that is
  likewise handed no collection belongs on that helper, not on a re-derived check.
- `vault-filter-controlled-access/` — the vault sidebar's "Controlled access" group and the
  narrowing its children apply to the item list. Its children partition
  `AccessBadgeState.kind`: "Privileged" and "My requests" (`pending`/`ready`/`active`) ship,
  and "Unavailable" cannot be built at all while `cipherAccessBadgeState()` never produces
  that kind. Add a child by appending to `CONTROLLED_ACCESS_FILTERS`, not by branching in
  `narrow$`.
- `access-state-badge/`, `vault-row-lease-badge/`, `item-details-state-badge/` — the one
  access-state pill, and the two hosts that render it: a vault row, and the open item's
  name row. The hosts differ only in how they refresh — the item-details one re-reads on
  `AccessRefreshService` so it cannot contradict the banner below it, the row one reads
  once so a list of gated rows does not carry a subscription each. The item-details host
  also drops the `active` state, because the banner heading under it already runs that
  countdown on its own timer. Which badge to show is NOT decided here: the SDK ranks the
  three states into `CipherAccessStateView.badgeState`, and `cipherAccessBadgeState()`
  only adapts that onto the presentation model (a `kind` discriminant, a parsed `Date`).
  Add a state by teaching the SDK, not by re-ranking the parts client-side.
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

`abstractions/access-rule.ts` re-exports the SDK's `AccessRuleError` — a flat shape
(`{ name: "AccessRuleError", variant, message }`) following the wasm-bindgen error convention —
and pairs it with a LOCAL structural guard, because the SDK's own `isAccessRuleError` is a runtime
wasm import and this directory stays type-only (see "`export type` matters" below). Use
`accessRuleErrorMessage()` / `isAccessRuleNotFound()` to interpret it; never treat it as
`ErrorResponse`. `AccessRuleErrorVariant` bridges on `NotFound`, which the Rust side maps from the
server's 404 on the by-id calls but no published `sdk-internal` declares yet; collapse the alias on
the next bump. The SDK splits its own failures per client —
`AccessRequestError` (request/activate/cancel), `ApprovalError` (decide) and `AccessLeaseError`
(read/extend/end). `abstractions/access-lease.ts` unions them as `LeasingError`, detected
through the injectable `LeasingErrorService` seam so consumers never import the wasm guards.
All three carry an `Api` variant holding the server's message. That variant's payload is the whole
serialized response, so `abstractions/api-error.ts` owns the one `apiErrorBodyMessage()` decode of
the `ErrorResponseModel` body — use it rather than re-parsing; what a miss means (generic copy, or
the raw string) stays with the caller.

A rejected access-request submit is interpreted by
`helpers/request-access-error.ts`. Three of the server's messages mean the caller already
has what they asked for; those are reconciled (collapse the form, re-read the state) rather
than surfaced as errors.

That file carries TWO catalogs, and the split is deliberate. `REQUEST_ACCESS_SERVER_ERRORS`
holds the sentences `SubmitAccessRequestCommand` throws; `REQUEST_ACCESS_SDK_ERRORS` holds the
ones the SDK raises locally, before the wire, which reach `.message` verbatim because
`AccessRequestError::Validation` is `#[error(transparent)]`. The two are NOT kept in step — an
elapsed window is "The end date must be in the future." from the server and "The requested
window has already ended." from the SDK. They were once assumed identical, so only the SDK's
spelling was listed and every server-side refusal fell through to the generic toast
(PM-42592). A condition refused on both sides needs an entry in both catalogs; the literal
sentences are pinned in `request-access-error.spec.ts` rather than compared against themselves,
so drift fails a test instead of degrading the copy silently.

Both `*ExceedsMax` entries are still exact sentences carrying the GLOBAL 24h cap, while the
server interpolates the governing rule's own `EffectiveMax` — so a rule with a narrower
`MaxLeaseDurationSeconds` misses them. Only reachable on skew, since the form narrows its own
picker to that cap; matching on the prefix is the fix when it is worth doing.

## `export type` matters

`abstractions/access-rule.ts` and `abstractions/access-lease.ts` re-export SDK shapes
using `export type` (not `export`) — type-only and erased at compile time, so jest never
resolves the wasm SDK package when running this directory's unit tests. Keep new
re-exports of SDK shapes type-only for the same reason.

## Status spelling follows the SDK

`canceled`, one L — in code, in i18n keys (`pamStatusCanceled`), everywhere. The SDK's own
`TryFrom` conversions normalise incoming wire values onto these spellings, so the module
never sees the other form.

## Activation is not a status

`AccessRequestStatus` has no `activated` value. An activated request stays `approved` and is
recognised by the `producedLeaseId` it minted, with `producedLeaseStatus` carrying that lease's
state. Anything separating "approved, still to start" from "already running" must test
`producedLeaseId` rather than the status — that is what keeps the nav badge, the Pending list and
the Start/Cancel actions off a grant the requester has already activated.

`AccessLeaseStatus` carries a distinct `canceled` (the requester ended their own lease) next to
`revoked` (an operator did), and `historyDisplayStatus` reads the label straight off
`producedLeaseStatus` — it does not scan the decision log. Optimistic patches must therefore write
the matching one: the holder's own `endLease` writes `canceled`, an approver's `revokeLease` writes
`revoked`. `AccessLeaseView` additionally carries `termination: AccessLeaseTermination | undefined`,
which spells out which happened and when; the row builders have no need for it, since
`producedLeaseStatus` already rides on the request.

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
binds them all: `CIPHER_VIEW_BANNER`, `GATED_CIPHER_RELOADER`, `ITEM_DETAILS_STATE_BADGE`
(all `libs/vault`),
`VAULT_ROW_LEASE_BADGE` (one badge component for both cipher and collection rows —
collection rows show the "Privileged" pill straight off the collection's server-derived
`hasEnabledAccessRule`), `VAULT_FILTER_GATED_COLLECTION_INDICATOR` (the lock glyph on a
governed collection in the vault's Filters sidebar, reading that same
`hasEnabledAccessRule` off the sidebar's own collection node — `VaultFilterService`
carries it onto the copy `buildCollectionTree` makes through `new CollectionView(...)`,
whose field initializer would otherwise reset it to `false`),
`VAULT_GATED_COLLECTION_BANNER` (the notice above the item list naming that same
restriction while a governed collection is the active filter, off the shared per-org
`GovernedCollectionsService` lookup, because it is handed ids alone and so has no flag
to read), `VAULT_CONTROLLED_ACCESS_FILTER` (the sidebar's "Controlled access" group plus
the narrowing its children apply to the item list),
`COLLECTION_ACCESS_RULE_CALLOUT`, `PamNavBadgeService`, and
`VaultRowAccessActionsService` (the vault-row menu's cancel-request entry; all `apps/web`).
Add a seam rather than importing PAM from OSS code.

## Routing and DI

`pam-routing.module.ts` (admin console) guards every route with
`canAccessFeature(FeatureFlag.Pam)`; `access-rules` additionally requires
`organizationPermissionsGuard((org) => org.canManageAccessRules)`.

**Authoring a rule and deciding a request against it are separate authorities — do not
collapse them into one check.** `canManageAccessRules` (Admin/Owner) gates the rules admin
UI and nothing else; the approver surfaces gate on Manage over a collection
(`hasApprovalPrivileges` / `ApprovalPrivilegeService`), mirroring the server's `ApproverCollectionAccessQuery`, which is
what actually authorizes the inbox read and the decision. Reusing the rules permission as a
proxy for "is an approver" locks every non-admin collection manager out of an inbox the
server would have served them.

`access-requests/access-requests-routing.module.ts` (user-scoped) additionally guards the
`approvals` tab with `canViewApprovalsGuard`, which redirects a non-approver to
`my-requests` rather than blocking. Mounting these modules and calling `providePam()` from
`app.module.ts` happen elsewhere.
