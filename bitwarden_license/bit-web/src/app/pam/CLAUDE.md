# PAM web UI (`bitwarden_license/bit-web/src/app/pam`)

Commercial home for Privileged Access Management: the access-rules admin UI, the
requester's leasing flow, and the approver's inbox. Gated behind `FeatureFlag.Pam`
(`pm-37044-pam-v-0`).

## The shared layer lives in `bit-common`

`bitwarden_license/bit-common/src/pam/` holds it, so `bit-browser` can share it. These paths
here are one-line re-exports of their `@bitwarden/bit-common/pam/…` counterpart:
`abstractions/`, `helpers/` and `date/` entirely; `services/*-sdk.service.ts`,
`services/default-access-event.service.ts`, `services/default-access-refresh.service.ts`,
`services/default-leasing-error.service.ts` and `services/pam-membership.ts`;
`access-state-badge/access-badge-state.ts`; and `testing/decision-builders.ts`. Their specs
are in `bit-common`. `index.ts` re-exports `bit-common`'s barrel and adds the web-only
exports (the audit API and rotation).

**Edit the file in `bit-common`, never the shim.** Where a section below names a file at one
of those paths, it means the `bit-common` copy.

## Surfaces

- `abstractions/` / `helpers/` / `date/` — shims over `bit-common` (see above).
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
  shareable single request at `/pam/requests/:id`. `MyAccessService`,
  `ApproverInboxService`, and `AccessNameResolverService` are provided on the SHELL
  ROUTE, not on the component, because routed children inherit a parent route's
  providers but not a component's — that is what lets the tabs share one load.
- `access-requests/access-request-route/` — `/pam/requests/:id`. A real route, not a
  click handler, because the rows link to it and both the requester's and the approvers'
  emails deep-link to it; but a DIALOG over the shell rather than a page of its own. It
  is a fourth child of the shell route, so the header and tab bar stay mounted;
  `access-request-route.component` is the host (opens the dialog, renders the tab the
  caller came from behind it, and on close REPLACES the URL with `/pam/<that tab>`, so a
  dismissed dialog is never left addressable and never stacked on top of), and
  `access-request-dialog.component` is the view. The same link serves both sides, so the
  dialog's footer follows `viewer$`: Start / Cancel / End for the requester, Approve /
  Deny, Withdraw approval or Revoke for an approver, never the other side's. Approver
  actions go through the shell's `ApproverInboxService`, which also decides whether the
  viewer may take them, and their confirms and toasts through `ApproverActionsService`,
  the one the Approvals and History tabs use. It is provided on each component, since a
  route provider never reaches a dialog. `originTab` picks the tab off the previous navigation's URL,
  matched on the whole `/pam/<tab>` shape (`tabFrom` returns undefined for anything
  else), so an approver opening a row keeps the Approvals inbox behind the dialog rather
  than watching it swap to their own requests. With no tab to read, from outside the
  tabs or on a cold load, the fallback follows the viewer: Approvals for an approver,
  My requests for the requester. No tab renders until `viewer$` resolves, so neither
  lands behind the dialog first; a load that settles without a request (not found or
  failed) falls back to My requests. Do not step the browser back on close instead: the
  router's `previousNavigation` says only that this SPA session navigated before, never
  that the browser has an entry below this one to go back to.
  `AccessRequestDetailService` is provided on the host component, not the route config,
  because it reads the `:id` off `ActivatedRoute` — a route-level provider resolves in
  the route's environment injector, where that lookup falls through to the root route.
  The host hands the service to the dialog through `DIALOG_DATA` for the same reason:
  `DialogService` builds the dialog's injector from the root one.
- `approvals/` — the approver side: the SDK-backed inbox data service, the decide
  dialog, the privilege check, and the route guard.
- `cipher-view-banner/` — the requester's entry point on an open gated cipher: five
  states, four off `cipher_access_state()` plus an inline request form, and the licensing
  block (PM-39423). The block comes FIRST and replaces every other state, active lease
  included, because the server stops releasing a gated cipher's secrets to an unlicensed
  holder whatever lease they hold (`CipherLeaseGate.LeaseCanRelease`) — withdrawing a seat
  withdraws what the outstanding leases were carrying, so a countdown here would narrate
  access no longer being served. Withdrawing an outstanding request stays reachable from the
  vault-row menu and the My requests tab, neither of which is licensing-gated. It is also the
  one state not derived from the access-state read: licensing is per-member, so it comes off
  local membership state via `services/pam-membership.ts` with no round trip, and renders even
  when that read fails. The signal is tri-state — `undefined` until membership lands — so
  readers test `=== false`, not truthiness; treating "not yet known" as licensed flashes the
  request card and fires its pre-check at someone about to be blocked.
- `services/pam-membership.ts` — `callerOrganizations$` (the `getOptionalUserId` +
  `organizations$` pipeline several surfaces here hand-rolled) and `unlicensedForPam`. The
  latter is PRESENTATION policy, which is why it is not on `Organization`: only
  `Organization.canAccessPrivilegedAccess` (`usePam && accessPam`, shaped like
  `canAccessSecretsManager`) is the entitlement the server evaluates. The other three
  conditions decide whether it is honest to say anything at all — no `usePam` (no license to
  be missing), `accessPam !== false` (an un-synced persisted blob is not an answer), not
  `enabled` (a lapsed subscription is the wrong reason), and never a provider user
  (`ProfileProviderOrganizationResponseModel` hardcodes `AccessPam = false` while still
  reporting the client org's `UsePam`). Do not "simplify" it to `!accessPam`.
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
  name row. Both re-read on `AccessRefreshService` so neither can contradict a mutation
  made beside it — the row badge because cancelling a request from that row's own menu
  otherwise left the old pill standing until a reload (PAM-200). The item-details host
  also drops the `active` state, because the banner heading under it already runs that
  countdown on its own timer — but it drops it on a LIVE lease (`liveActiveLease`), not on
  the SDK's `active` ranking, or a lease the server still believes in after it lapsed would
  hide the pill for good (see "A lease running out"). Which badge to show is NOT decided
  here: the SDK ranks the three states into `CipherAccessStateView.badgeState`, and
  `cipherAccessBadgeState()` only adapts that onto the presentation model (a `kind`
  discriminant, a parsed `Date`).
  Add a state by teaching the SDK, not by re-ranking the parts client-side.
  `ENDING_SOON_THRESHOLD_MS` (`access-badge-state.ts`) is the five-minute cutoff at which an
  active lease escalates to the danger recipe — a fixed cutoff, not a fraction of the lease's
  length (PM-40498). It is exported rather than private to the badge because the cipher-view
  banner escalates on it too: that surface has the `active` badge suppressed, so its heading is
  the only countdown there and has to carry the warning itself. A new countdown must read this
  constant, not restate five minutes.
- `collection-access-rule-callout/` — names the rules governing a collection, inside the
  collection edit dialog.
- `services/` — the web-only services (`my-leases`, `pam-nav-badge`, `governed-collections`,
  `access-rules`, …) beside shims for the SDK-backed ones in `bit-common`.
- `testing/` — `story-fixtures.ts`, and a shim for `decision-builders.ts`.

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

`helpers/pam-license-error.ts` owns the one copy of the server's licensing refusal
(`PamLicenseGuard.UnlicensedMessage`), which all three acquiring paths throw. The submit and
activate catalogs and the extend handler all match through it rather than spelling the sentence
again — only its FIRST sentence, so the "ask your admin" half can be reworded server-side without
degrading three surfaces to generic copy. Note the two surfaces with no licensing block of their
own — the My requests tab and the shared request dialog — reach it only through that toast, since
they offer Start off a request row with no cipher in hand.

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

The two `*ExceedsMax` refusals are NOT catalog entries — the server interpolates its
`EffectiveMax` into them, so no fixed sentence matches more than one rule. `EXCEEDS_MAX_PATTERN`
captures the noun and the maximum instead. The window path re-renders through
`requestAccessModalWindowExceedsMax`; the duration path has no such string and echoes the server.
Keep the noun: the automatic path shows no window, so the two cannot share wording.

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

### A lease running out

**Neither service fires when a lease reaches its `notAfter`** — no mutation here, and on the
server nothing happened at all. Left to them, an item open across its own expiry keeps the
credential revealed until a reload (PM-41837). With no event to wait for, every reader of
`activeLease` goes through `liveActiveLease(state, nowMs)` (`helpers/lease-liveness.ts`), which
drops a lapsed lease whatever the response said and fails closed on an unparseable `notAfter`.

Something has to move that clock. **Use one of the two that already tick; do not add a third.**
The cipher-view banner owns a 1-second interval for its countdown, live exactly while there is an
active lease, so its clamp is one `computed`. `ItemDetailsStateBadgeComponent` and
`PamGatedCipherReloader` take a single tick off `AccessBadgeTickerService.ticks$`, the shared
clock the badges run on, and only while the state they hold carries a live lease.

Both tick OUTSIDE the Angular zone, or NgZone never settles and `whenStable()` hangs for every
host embedding a gated item. Signals carry out of it, so the banner and the pill need nothing
more; the reloader re-enters explicitly, because the re-lock writes plain component fields on
`vault-item-dialog.component.ts`.

`badgeState` is NOT clamped — only the SDK ranks it, so a lapsed `active` badge falls to
`AccessStateBadgeComponent`'s `remainingMs <= 0` recipe. The vault row stays out of all this —
no ticker, no clamp — though it does re-read on `AccessRefreshService`.

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
`COLLECTION_ACCESS_RULE_CALLOUT`, `PamNavBadgeService`,
`VaultRowAccessActionsService` (the vault-row menu's cancel-request entry), and
`PAM_ORG_ADMIN_ROUTE` (the `pam` path under `/organizations/{id}`, so the Admin Console's
redirect guard can land a member who holds only one of the PAM permissions — see "Routing and
DI"; all `apps/web`).
Add a seam rather than importing PAM from OSS code.

## Routing and DI

`pam-routing.module.ts` (admin console) guards every route with
`canAccessFeature(FeatureFlag.Pam)`; `access-rules` additionally requires
`organizationPermissionsGuard((org) => org.canManageAccessRules)` and `rotation`
`organizationPermissionsGuard((org) => org.canManageRotation)`.

**The rotation fleet is a third authority, separate from rule authorship — do not reuse
`canManageAccessRules` for it.** `canManageRotation` is Admin/Owner, or a Custom member
holding `ManageRotation`, mirroring the server's `ManageAccessConnectorRequirement`.
`ManageAccessRules` is authority over who may lease a credential, not over the connectors that
rewrite it at the target system, so a Custom member holding only the rule permission who reaches
`rotation/` gets a 403 from every request the page makes.

**Authoring a rule and deciding a request against it are separate authorities — do not
collapse them into one check.** `canManageAccessRules` (Admin/Owner, or a Custom member
holding `ManageAccessRules`) gates the rules admin UI and nothing else; the approver surfaces
gate on Manage over a collection
(`hasApprovalPrivileges` / `ApprovalPrivilegeService`), mirroring the server's `ApproverCollectionAccessQuery`, which is
what actually authorizes the inbox read and the decision. Reusing the rules permission as a
proxy for "is an approver" locks every non-admin collection manager out of an inbox the
server would have served them.

**Holding `ManageAccessRules` or `ManageRotation` alone has to be enough to enter the Admin
Console.** No other `canAccessXTab` predicate implies either PAM surface, so `canAccessOrgAdmin`
gained `canAccessAccessRulesTab` and `canAccessRotationTab` arms and `getOrganizationRoute` a
matching landing arm; without them, the org route's guard bounces such a member to `/` and they
never see the nav item. The landing arm reads `PAM_ORG_ADMIN_ROUTE` rather than hardcoding `pam`,
because OSS builds do not mount these pages — which is why `organizationRedirectGuard` runs its
callback inside an injection context.

That lands them on `pam` itself, which is not a page: `pam-landing-route.ts` picks the section
from there, in the side nav's order, and the index route runs it through the same
`organizationRedirectGuard`. It replaced a static redirect to `access-rules`, which sent every
member to the one section only the rule permission opens.

`access-requests/access-requests-routing.module.ts` (user-scoped) additionally guards the
`approvals` tab with `canViewApprovalsGuard`, which redirects a non-approver to
`my-requests` rather than blocking. Mounting these modules and calling `providePam()` from
`app.module.ts` happen elsewhere.
