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
- **AccessLease** — minted on activation; status `active` → `expired` / `revoked`.
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

Abstract class: `src/abstractions/pam-api.service.ts`. HTTP impl:
`bitwarden_license/bit-web/src/app/pam/services/default-pam-api.service.ts`
(commercial). Routes (all under the standard API base; `send()` is the thin
wrapper):

| Method & path                                                    | Purpose                                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET /ciphers/{id}/lease/state`                                  | Access-state snapshot (active lease / pending / approved request). 404 = not gated or flag off → empty snapshot, banner inert. |
| `GET /ciphers/{id}/lease/pre-check`                              | Resolve approval workflow (`AccessApprovalMode`) for the caller.                                                               |
| `POST /ciphers/{id}/lease`                                       | Submit an access request.                                                                                                      |
| `GET /ciphers/{id}/lease/cipher`                                 | **@deprecated** — full leased cipher; scheduled for removal.                                                                   |
| `GET /access-requests/inbox` `/history` `/mine`                  | Approver pending / approver history / requester's own.                                                                         |
| `POST /access-requests/{id}/decision`                            | Approver approve/deny (`AccessDecisionRequest`).                                                                               |
| `POST /access-requests/{id}/revoke`                              | Cancel a pending / approved request.                                                                                           |
| `POST /access-requests/{id}/activate`                            | Activate an approved request → mints the lease.                                                                                |
| `GET /leases/mine` `/active` `/history`                          | Caller's leases / managed-scope active / managed-scope ended.                                                                  |
| `POST /leases/{id}/extend`                                       | Request an extension (`AccessLeaseExtensionRequest`).                                                                          |
| `POST /leases/{id}/revoke`                                       | End an active lease (`AccessLeaseRevokeRequest`).                                                                              |
| `GET·POST·PUT·DELETE /organizations/{orgId}/access-rules[/{id}]` | Rule CRUD.                                                                                                                     |

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
- `AccessLeaseStatus` — `active | expired | revoked`.
- `ConditionKind` — `human_approval | ip_allowlist`.
- `GatedState` (`helpers/gated-state.ts`) — `unleased | gated_no_lease | gated_active_lease`.

A request's decision log is `decisions: Decision[]` on
`AccessRequestDetailsResponse`; use `helpers/find-human-decision.ts` to pull the
human (non-automatic) decision for display.

## Library layout

- `abstractions/` — interfaces, enums, and `responses/` DTOs (server → client).
  Includes the abstract `PamApiService`, `GovernanceService`, and
  `AccessEventService`. (The
  `PamInboxBadgeService` nav-badge seam lives in `apps/web/src/app/pam/`, **not
  here** — OSS code consumes it, so it stays outside `bitwarden_license/`.)
- `services/requests/` — `requests/` (client → server DTOs) only. The `Default*`
  service implementations **moved to commercial**
  (`bitwarden_license/bit-web/src/app/pam/services/`): `DefaultPamApiService`,
  `DefaultAccessEventService` (filters the app-wide push stream to
  `NotificationType.RefreshAccessRequest` (29) and exposes `accessChanged$()`),
  and `LeasedCipherFetcherService` (wraps the deprecated leased-cipher fetch into
  a transient `Cipher`).
- `helpers/` — **pure, framework-free** functions (formatting, filtering,
  validation, lease-window math). Each has a `.spec.ts` alongside. Keep them free
  of Angular/DOM so they stay CLI-shareable.
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

## Tests

`npm test -- bit-pam` (or `npx jest bitwarden_license/bit-pam`). Built as part of
the consuming `bit-web` build — `bit-pam` is path-mapped (`@bitwarden/bit-pam`),
not a standalone Nx project.
