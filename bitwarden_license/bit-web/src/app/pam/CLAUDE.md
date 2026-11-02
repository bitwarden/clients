# PAM web UI (`bitwarden_license/bit-web/src/app/pam`)

Commercial home for the PAM access-rules admin UI: the list, the routed
create/edit page, and the IP-allowlist editor. Gated behind `FeatureFlag.Pam`
(`pm-37044-pam-v-0`).

## Surfaces

- `abstractions/` / `helpers/` — framework-agnostic contract layer: domain
  types and error helpers (`abstractions/access-rule.ts`), the abstract
  `AccessRuleSdkService` contract (`abstractions/access-rule-sdk.service.ts`),
  and pure helpers (`helpers/`). Re-exported via `index.ts`. No Angular
  runtime APIs here; keep it that way so this stays unit-testable without a
  TestBed. Type-only imports of component-library option shapes (e.g.
  `SimpleDialogOptions`) are fine, since they are erased at compile time.
- `access-rules/` — list (`access-rules.component` + `.service`) and the
  routed create/edit page (`access-rule-edit.component`), at `access-rules`,
  `access-rules/new`, `access-rules/:accessRuleId`.
- `access-rule-edit/ip-allowlist/` — the `ip_allowlist` condition's CIDR editor
  plus its validators (delegates to the SDK's `is_valid_cidr`). The editor is a
  thin view over a `FormArray` owned by the edit page's form group (passed in via
  a `cidrArray` input): the array-level validators live on the host control so
  validity flows through the parent form, and the page disables the array while
  the condition is off. Per-row CIDR validation rides on each pushed control.

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

Routed edit pages take `canDeactivate: [unsavedChangesDialogGuard]` (`unsaved-changes.guard.ts`)
and implement `HasUnsavedChangesDialog`: `unsavedChanges()` returns `false`, `true` for the
default discard dialog, or options overriding it. Cancel just navigates and lets the guard ask.
The guard stands down on lock and logout.

`provide-pam.ts` binds `AccessRuleSdkService` (`./index`) to
`AccessRulesSdkService`, which serves CRUD via the Rust SDK's
`commercial().pam().access_rules()` client — never HTTP.
