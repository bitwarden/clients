# PAM web UI (`bitwarden_license/bit-web/src/app/pam`)

Commercial home for the PAM access-rules admin UI: the list, the routed
create/edit page, and the IP-allowlist editor. Gated behind `FeatureFlag.Pam`
(`pm-37044-pam-v-0`).

## Surfaces

- `abstractions/` / `helpers/` — framework-agnostic contract layer: domain
  types and error helpers (`abstractions/access-rule.ts`), the abstract
  `AccessRuleSdkService` contract (`abstractions/access-rule-sdk.service.ts`),
  and pure helpers (`helpers/`). Re-exported via `index.ts`. No Angular APIs
  here; keep it that way so this stays unit-testable without a TestBed. Was
  its own package (`@bitwarden/bit-pam`) — folded in here since `bit-web` was
  its only consumer.
- `access-rules/` — list (`access-rules.component` + `.service`) and the
  routed create/edit page (`access-rule-edit.component`), at `access-rules`,
  `access-rules/new`, `access-rules/:accessRuleId`.
- `access-rule-edit/ip-allowlist/` — the `ip_allowlist` condition's CIDR editor
  plus its validators (delegates to the SDK's `is_valid_cidr`). The editor is a
  thin view over a `FormArray` owned by the edit page's form group (passed in via
  a `cidrArray` input): the array-level validators live on the host control so
  validity flows through the parent form, and the page disables the array while
  the condition is off. Per-row CIDR validation rides on each pushed control.

## Vault-gating providers

Concrete implementations bound to the optional seam tokens `libs/vault`/
`apps/web` define for privileged-access hosts (unprovided elsewhere, so those
repos have no PAM dependency):

- `cipher-open-gate.service.ts` (`PamCipherOpenGate`) → `CIPHER_OPEN_GATE`.
  Fetches the full cipher via `LeasedCipherFetcherService` when an active
  lease already covers it; otherwise opens the partial copy and lets the
  cipher-lease banner drive the request flow.
- `gated-cipher-reloader.service.ts` (`PamGatedCipherReloader`) →
  `GATED_CIPHER_RELOADER`. Polls `AccessRequestSdkService.getCipherAccessState`
  (the SDK-backed leasing services here are pull-, not push-based) and reveals
  the full cipher in place once a lease appears.
- `services/leased-cipher-fetcher.service.ts` (`LeasedCipherFetcherService`) —
  the sole producer that re-reads a cipher straight from the server and hands
  back a full `Cipher` domain object once it is no longer gated; both
  providers above depend on it. Never writes the result to the local cache.
- `vault-row-lease-badge/` (`VaultRowLeaseBadgeComponent`) →
  `VAULT_ROW_LEASE_BADGE`. One-shot (not polled) per-row access-state fetch;
  the reveal-in-place behavior that needs live polling lives in the reloader.
- `cipher-lease-banner/` (`CipherLeaseBannerComponent`) → `CIPHER_VIEW_BANNER`.
  The fold-out "request access" form: pre-checks the approval workflow
  (`preCheckAccessRequest`), submits (`createAccessRequest`), and activates an
  approved request (`activateAccessRequest`). Lease extension/early-end stay
  on the "My access" page (`AccessLeaseSdkService`), not in this banner.

Known limitation: `CipherView.leaseGated` has no reachable producer through
`libs/vault`'s decrypt path since the partial-cipher pivot removed the
domain-`Cipher` field it used to ride on (`DefaultCipherEncryptionService.decrypt`
never re-attaches it). This only affects whether the banner keeps polling
lease state _after_ a reveal in the same dialog session — the core
request → activate → reveal flow is unaffected, since it keys off `partial`.

`AccessRequestSdkService` also carries three cipher-scoped methods
(`getCipherAccessState`, `preCheckAccessRequest`, `createAccessRequest`)
alongside its "My access" ones — all served via the SDK's
`commercial().pam().access_requests()` client, `cipherId` taken as a plain
`string` to match the seam tokens' shape.

## CRUD is SDK-served, not HTTP

Access-rule CRUD goes through the Rust SDK
(`client.commercial().pam().access_rules()`), never HTTP. `AccessRuleSdkService`
(`abstractions/access-rule-sdk.service.ts`) is the abstract contract;
`services/access-rules-sdk.service.ts` composes the SDK client.

## Error shape

`abstractions/access-rule.ts` defines `AccessRuleError` — a flat,
hand-written shape (`{ name: "AccessRuleError", variant, message }`) mirroring
the SDK's wasm-bindgen error convention. Use `accessRuleErrorMessage()` /
`isAccessRuleNotFound()` to interpret it; never treat it as `ErrorResponse`.

## `export type` matters

`abstractions/access-rule.ts` re-exports `AccessCondition`,
`AccessRuleAddEditRequest`, and `AccessRuleView` from `@bitwarden/sdk-internal`
using `export type` (not `export`) — this is type-only and erased at compile
time, so jest never resolves the wasm SDK package running this directory's
unit tests. Keep new re-exports of SDK shapes type-only for the same reason.

## Routing and DI

`pam-routing.module.ts` guards every route with `canAccessFeature(FeatureFlag.Pam)`;
`access-rules` additionally requires `organizationPermissionsGuard((org) =>
org.canManageAccessRules)`. Mounting this module (`organizations-routing.module.ts`)
and calling `providePam()` from `app.module.ts` happen elsewhere.

`provide-pam.ts` binds `AccessRuleSdkService` (`./index`) to
`AccessRulesSdkService`, which serves CRUD via the Rust SDK's
`commercial().pam().access_rules()` client — never HTTP.
