# `@bitwarden/bit-pam` — Privileged Access Management (credential leasing)

This **commercial** library is the framework-agnostic **contract** layer of PAM:
the domain types, the abstract API client (`PamApiService`), the access-event
abstraction, the wire DTOs, and pure helpers. It deliberately holds **no
implementations and no components** — the concrete `Default*` services, the
cipher-lease banner, and the entire web UI live alongside it under
**`bitwarden_license/bit-web/src/app/pam/`** and consume these abstractions. See
that directory's `CLAUDE.md` for surfaces, routing, and DI wiring.

PAM is a commercial feature, so this entire contract layer lives under
`bitwarden_license/` (license-locked). The **one exception** is
`PamInboxBadgeService`, the OSS nav-badge seam: it lives in
`apps/web/src/app/pam/pam-inbox-badge.service.ts` because OSS code (`apps/web`)
consumes it and may not import licensed code. The whole feature is gated behind
the `pm-37044-pam-v-0` (`FeatureFlag.Pam`) flag.

## Read the spec first: `pam.allium`

`bitwarden_license/bit-pam/pam.allium` is the **authoritative design spec** (an Allium prose/rules
spec). It models every entity and its state machine, cipher-open gating, request
evaluation, lease lifecycle, the UI surfaces, and the invariants. When a behavior
is unclear or contested, the spec is the source of truth — read it before the
code. Two caveats when reading it:

- It marks server-owned logic as `deferred` (e.g. `deferred GoverningRule`).
  Those predicates are **not** implemented client-side (see cross-repo split).
- `@guidance` and `open question` blocks flag where the **implementation may lag
  or diverge** from the intended design. The spec describes intent; the code may
  not yet match it. (Example: an old `@guidance` note about auto-activating an
  approved request on cipher-open — the code no longer does this; activation is
  always an explicit member action.)

## Cross-repo split — the evaluation logic is NOT in this repo

The spec and all **client** code are here; the decision/evaluation **logic** lives
in the separate **`bitwarden/server`** repo under `src/Core/Pam/` (e.g.
`Services/GoverningRuleResolver.cs`, `Engine/AccessRuleEngine.cs`). Clients never
run governing-rule resolution or condition evaluation — they submit requests and
**render the server's verdict** (`AccessApprovalMode`, request `status`, lease
`status`). A bug cited against a `pam.allium` passage often has to be fixed
server-side. Server tests: `dotnet test test/Core.Test/Core.Test.csproj --filter
"FullyQualifiedName~Bit.Core.Test.Pam"`.

## Domain model (full state machines are in the spec)

- **AccessRule** — org policy attached to one or more collections. Its
  `conditions[]` (a flat array, ANDed: `human_approval`, `ip_allowlist`) gate the
  request **decision**. Separately, its lease constraints (`singleActiveLease`,
  `maxLeaseDurationSeconds`, `allowsExtensions` / `maxExtensionDurationSeconds`,
  `defaultLeaseDurationSeconds`) shape the **lease** at activation — a different
  axis; don't conflate them. `enabled` toggles the whole rule.
- **AccessRequest** — member-submitted; status flows `pending` → `approved` →
  `activated`, or to `denied` / `cancelled` / `expired`. An `approved` request is
  a **single-use grant** — no lease exists yet.
- **AccessLease** — minted on activation; status `active` → `expired` / `revoked` (operator-ended) / `cancelled` (holder-ended).
- **LeasingFreeze** — org-wide block on starting new leases (the kill switch's
  optional "block new leases").

## Behaviors that are easy to get wrong

- **Union/OR gating.** A cipher is gated for a member only when **every**
  collection path they have to it carries an enabled rule. One ungated path = full
  ungated access (a deliberate, admin-visible bypass). Authoritative on the
  server; any client-side check is **advisory** and cannot release withheld data.
- **Approval ≠ access.** An approved request grants nothing on its own. The
  requester **explicitly activates** it (`POST /access-requests/{id}/activate`) to
  mint the lease, at a time of their choosing. There is **no auto-activation** —
  do not add it.
- **Activation re-checks at start.** Automated conditions (e.g. `ip_allowlist`)
  and `singleActiveLease` contention are re-checked when the lease is minted. A
  failed activation **consumes nothing** — the request stays `approved` for a
  manual retry. There is no queue.
- **Extensions extend in place.** An extension is a child `AccessRequest` with
  `extensionOfLeaseId` set; on approval it pushes the parent lease's `notAfter`
  out rather than minting a new lease. UI folds it into the parent row.
- **Self-approval is forbidden** (`helpers/can-approve.ts`).

## API client — `PamApiService`

Abstract class: `src/abstractions/pam-api.service.ts`. Two implementations sit
behind it, split by transport — **rule CRUD goes through the Rust SDK; every
other lease/request/audit call stays HTTP.**

- **HTTP impl**: `bitwarden_license/bit-web/src/app/pam/services/default-pam-api.service.ts`
  — covers every row below except the last. Routes are all under the standard
  API base; `send()` is the thin wrapper.
- **SDK impl**: `bitwarden_license/bit-web/src/app/pam/services/access-rules-sdk.service.ts`
  (`AccessRulesSdkService`) — the five access-rule CRUD methods, composed into
  `DefaultPamApiService` (constructor param) rather than implemented there.
  Calls `client.commercial().pam().access_rules()` per the canonical
  SDK-consumption pattern (see `SendSdkApiService` in `libs/common`): resolve
  the active user, `sdk.take()` a client `Ref`, dispose it (`using`) once the
  call settles. IDs cross `PamApiService` as plain `string`s and are branded
  via `asUuid<T>()` only at the SDK call site. Errors surface as the SDK's flat
  `AccessRuleError` shape (`{ name: "AccessRuleError", variant, message }`) —
  UI code interprets them via `accessRuleErrorMessage`/`isAccessRuleNotFound`
  (`src/abstractions/access-rule.ts`), never `ErrorResponse`.

| Method & path                                                                              | Purpose                                                                                                                        |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET /leases/ciphers/{id}/state`                                                           | Access-state snapshot (active lease / pending / approved request). 404 = not gated or flag off → empty snapshot, banner inert. |
| `GET /leases/ciphers/{id}/pre-check`                                                       | Resolve approval workflow (`AccessApprovalMode`) for the caller.                                                               |
| `POST /leases/ciphers/{id}`                                                                | Submit an access request.                                                                                                      |
| `GET /leases/ciphers/{id}/cipher`                                                          | **@deprecated** — full leased cipher; scheduled for removal.                                                                   |
| `GET /access-requests/inbox` `/history` `/mine`                                            | Approver pending / approver history / requester's own.                                                                         |
| `POST /access-requests/{id}/decision`                                                      | Approver approve/deny (`AccessDecisionRequest`).                                                                               |
| `POST /access-requests/{id}/revoke`                                                        | Cancel a pending / approved request.                                                                                           |
| `POST /access-requests/{id}/activate`                                                      | Activate an approved request → mints the lease.                                                                                |
| `GET /leases/mine` `/active` `/history`                                                    | Caller's leases / managed-scope active / managed-scope ended.                                                                  |
| `POST /leases/{id}/extend`                                                                 | Request an extension (`AccessLeaseExtensionRequest`).                                                                          |
| `POST /leases/{id}/revoke`                                                                 | End an active lease (`AccessLeaseRevokeRequest`).                                                                              |
| `listAccessRules`/`getAccessRule`/`createAccessRule`/`updateAccessRule`/`deleteAccessRule` | Rule CRUD — **SDK, not HTTP** (`AccessRulesSdkService`; see above).                                                            |

**Governance is a separate abstraction.** `getGovernanceSummary`,
`bulkRevokeLeases`, `unblockNewLeases`, and `isLeasingFrozen` live on their own
`GovernanceService` abstract class (`src/abstractions/governance.service.ts`),
**not** `PamApiService` — the governance dashboard and kill switch inject it
directly. It has no server implementation yet, so the web `provide-pam.ts` binds
it to a `MockGovernanceService` unconditionally (see the web `CLAUDE.md`); those
surfaces only function under that mock today.

**Refresh model.** `mutations$` is a `Subject` pumped after every successful
_write_ (submit, cancel, decide, activate, revoke, extend) — not after reads or
rule CRUD. `getCipherAccessState$()` re-fetches on `merge(initial,
accessEvents.accessChanged$(), mutations$)`, and additionally arms a timer at the
active lease's `notAfter` so a lazily-expiring lease re-locks the UI **without** a
server push. Aggregating surfaces (nav badges) subscribe to `mutations$` so a
local change reflects immediately rather than waiting for the push channel.

## Enums — const-objects, never TS `enum` (ADR-0025)

All in `src/abstractions/`. Codes matter (they cross the wire):

- `AccessDecisionVerdict` — `Deny: 0`, `Approve: 1`.
- `AccessApprovalMode` — `Automatic: 0`, `Human: 1`.
- `AccessDeciderKind` — `Human: "human"`, `Automatic: "automatic"`.
- `AccessRequestStatus` — `pending | approved | activated | denied | cancelled | expired`.
- `AccessLeaseStatus` — `active | expired | revoked | cancelled` (`cancelled` = the holder ended their own lease; `revoked` = an operator ended it).
- `GatedState` (`helpers/gated-state.ts`) — `unleased | gated_no_lease | gated_active_lease`.

`AccessCondition`'s `kind` is **not** a local const-object anymore — it's a
type-only re-export of the SDK's shape (`abstractions/access-rule.ts`), currently
`human_approval | ip_allowlist` plus an unknown-kind passthrough the SDK
preserves for forward-compat. Match on it defensively: filter to
`isKnownAccessCondition` (or use `isHumanApproval`/`isIpAllowlist`) before
switching, and skip anything else rather than rendering it.

A request's decision log is `decisions: Decision[]` on
`AccessRequestDetailsResponse`; use `helpers/find-human-decision.ts` to pull the
human (non-automatic) decision for display.

## Library layout

- `abstractions/` — interfaces, enums, and `responses/` DTOs (server → client)
  for the **HTTP** surfaces (leases, requests, audit). Includes the abstract
  `PamApiService`, `GovernanceService`, and `AccessEventService`.
  `abstractions/access-rule.ts` is the exception: rule CRUD moved to the SDK, so
  it holds no DTO class, just a type-only re-export of the SDK's
  `AccessRuleView`/`AccessRuleAddEditRequest`/`AccessCondition` shapes plus the
  small helpers around them (`accessRuleErrorMessage`, `isAccessRuleNotFound`,
  `isHumanApproval`, `isIpAllowlist`, `isKnownAccessCondition`). (The
  `PamInboxBadgeService` nav-badge seam lives in `apps/web/src/app/pam/`, **not
  here** — OSS code consumes it, so it stays outside `bitwarden_license/`.)
- `services/requests/` — `requests/` (client → server HTTP DTOs) for the
  lease/request/audit surfaces only — there is no `AccessRuleRequest` here
  anymore (the SDK's `AccessRuleAddEditRequest` type replaces it). The
  `Default*` service implementations **moved to commercial**
  (`bitwarden_license/bit-web/src/app/pam/services/`): `DefaultPamApiService`,
  `AccessRulesSdkService` (the SDK-backed rule-CRUD half `DefaultPamApiService`
  composes), `DefaultAccessEventService` (filters the app-wide push stream to
  `NotificationType.RefreshAccessRequest` (29) and exposes `accessChanged$()`),
  and `LeasedCipherFetcherService` (wraps the deprecated leased-cipher fetch into
  a transient `Cipher`).
- `helpers/` — **pure, framework-free** functions (formatting, filtering,
  validation, lease-window math). Each has a `.spec.ts` alongside. Keep them free
  of Angular/DOM so they stay CLI-shareable. `accessRuleToRequest`
  (`helpers/access-rule-request.ts`) builds the create/update payload for the
  enable/disable toggles by copying every field off the loaded `AccessRuleView`
  and overriding only `enabled` — copy _every_ field here, including
  `allowsExtensions`/`maxExtensionDurationSeconds`; a rule enable/disable toggle
  must not silently change unrelated settings.
- The cipher-lease banner component also lives in commercial code now
  (`bit-web/.../pam/cipher-lease-banner/`, bound to the `CIPHER_VIEW_BANNER`
  token); this library holds no components.

## Conventions & invariants for this library

- **No new encryption logic** here, and never send vault data unencrypted. The
  leased cipher is **transient** — never persist it into the local cipher cache;
  re-fetch on every view.
- **const-objects, not `enum`** (see the rule above and `.claude/rules/typescript.md`).
- **Observable data services** (RxJS, ADR-0003) — not Signals — because this code
  is shared below the Angular layer.
- Spec invariants the code upholds: at most one lease per activated request; no
  lease without an activated request; self-approval forbidden; revoked leases
  carry resolver fields; per-cipher single-active-lease (honored by union); at
  most one leasing freeze per org.

## Audit log — implementation status (server-side POC in progress)

The PAM **access-audit trail** is being turned from a synthesized read model into a **written record**. The
rationale is in `pam-audit.html` beside this file. The implementation is **server-side** (bitwarden/server, branch
`patrik/pam-audit-log`); this note lives here because that discussion doc and the governance `access-audit` UI do.

**Design (decided).** State-changing PAM actions emit audit events through `IAccessAuditEventEmitter` to a
dedicated append-only MSSQL table (`[dbo].[AccessAuditEvent]`); the governance trail is read straight from that
store. Each action emits a **before/after** pair — an `Attempt` before its point of no return and an `Outcome`
after (a `Phase` field) — non-transactionally, so a crash leaves an in-doubt Attempt rather than a lost event. Each
event is **self-contained**: the actor/requester/cipher/collection/rule display names are snapshotted into the row
at write time (resolved once in `AccessAuditEvent_Create`), so the read needs no joins and a later delete or rename
of a referenced entity cannot erase or rewrite what an event said. MSSQL + Dapper only.

**Done.**

- Emit seam made real: `AccessAuditEventEmitter` persists via `IAccessAuditEventRepository.CreateAsync`.
- New `[dbo].[AccessAuditEvent]` table + `_Create` proc + dated migrations; the read proc reads the store only.
- Self-contained rows: display names snapshotted at write (resolved in `AccessAuditEvent_Create`); read has no
  joins, so deletes/renames can't rewrite history.
- `Phase { Attempt, Outcome }` on the event model.
- All nine state-changing commands emit before/after (submit incl. auto-approval, decide, activate incl.
  rejection, cancel, extend, revoke, rule create/update/delete).
- Unit + integration tests.

**Outstanding / deferred.**

- **Time-derived events have no writer yet** — `RequestExpiredUnanswered`, `RequestExpiredUnactivated`,
  `LeaseExpired`. They need a background sweep; until then they do not appear in the trail.
- **Credential access** (`CredentialAccessed` / `CredentialAccessDenied`) — deferred.
- **Kill-switch / freeze** events — deferred.
- **Org event-log fan-out** (also write PAM events to the normal Bitwarden event log) — deferred fast-follow.
- **EF / self-host** (Postgres/MySQL/SQLite), **MSSQL Ledger** (tamper-evidence), **retention / export** — deferred.
- **Encrypted-name key-rotation caveat** — snapshotted cipher/collection names are EncString; a later org
  key-rotation may leave a historical snapshot undecryptable (the event + ids still stand).
- **Future cipher single-blob (must-not-forget)** — when cipher data moves to one opaque encrypted blob (no
  server-queryable `$.Name`), the `JSON_VALUE([Cipher].[Data], '$.Name')` snapshot in `AccessAuditEvent_Create` will
  stop resolving a cipher name; revisit then (e.g. store `CipherId` only and resolve client-side, or have the client
  supply the encrypted name at emit time).
- **UI: `Phase` handling** — the read returns both phases; the `access-audit` view still needs to decide whether to
  show Outcomes only, surfacing an unmatched Attempt as an in-doubt entry.
- **No backfill** — the stored trail begins at deployment; pre-existing history is not migrated.

## Tests

`npm test -- bit-pam` (or `npx jest bitwarden_license/bit-pam`). Built as part of
the consuming `bit-web` build — `bit-pam` is path-mapped (`@bitwarden/bit-pam`),
not a standalone Nx project.
