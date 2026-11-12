# bw pam approval

The approver's side of Privileged Controls. Follows the conventions in [`../README.md`](../README.md).

Follows the web, which hides Approvals from anyone who is not an approver. An approver is a member of an organization that uses PAM, who is not a provider user, and who either can edit all items in the organization (an owner or admin, but only where the organization gives them access to all collection items) or has Manage on at least one of its collections. Being an admin is not enough on its own. It is evaluated across all of the user's organizations, and no command takes `--organizationid`.

Every command, and every approvals `bw serve` route, checks this first and makes no SDK call for a non-approver. It prints `You are not an approver. Approving requests needs Manage on a governed collection, or the ability to edit all items in the organization.` and fails, instead of showing an empty inbox. The check reads the synced vault (organizations and decrypted collections, including each collection's `manage` flag), so run `bw sync` after a role or collection permission changes. No command is gated on `canManageAccessRules` or any other admin permission.

| Command                                                          | SDK call                   | Notes                                                                     |
| ---------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------- |
| `bw pam approval inbox [--names]`                                | `approvals().list_inbox`   | Rows whose `leaseNotAfter` is in the past are dropped.                    |
| `bw pam approval history [--names]`                              | `approvals().list_history` |                                                                           |
| `bw pam approval approve <requestId> [--comment <text>]`         | `approvals().decide`       | The comment is optional.                                                  |
| `bw pam approval deny <requestId> --comment <text>`              | `approvals().decide`       | The comment is required, and checked locally to be not blank.             |
| `bw pam approval withdraw <requestId> --yes`                     | `access_requests().cancel` | Only an approved request that was not started. See below.                 |
| `bw pam approval revoke-lease <leaseId> [--reason <text>] --yes` | `leases().end`             | Called directly through `PamSdkService`; no import from the leases group. |
| `bw pam approval managed-leases [--all] [--names]`               | `approvals().list_history` | Derived from history. Live leases only unless `--all`.                    |

## Behaviors

- The approver check mirrors `hasApprovalPrivileges` in `bit-web/src/app/pam/approvals/approval-privileges.ts`; `hasApproverPrivileges` in `bit-common/src/pam/approvals/approver-privileges.ts` must stay identical to it.
- Self-approval is refused by the server. The refusal is shown as a catalog message or its HTTP status.
- `decide` returns a partial view, so only `id`, `status`, `resolvedAt` and `verdict` are printed.
- A 409 "already resolved" or "window ended" on `decide` or `withdraw` is a non-fatal notice (exit 0, `action` is `already-resolved` or `window-ended`).
- `withdraw` is recorded by the server as the approver's denial, with no reason. The command's help and its output say so.
- `managed-leases` has no SDK call of its own, because the SDK has no organization-wide lease list. It reads `producedLeaseId`, `producedLeaseStatus` and `producedLeaseNotAfter` from history rows, so it covers only requests the caller can manage. `liveness` is `live` when the status is `active` and the window is open.
- There is no bulk approve-all.
- `ApprovalsClient` in the pinned SDK (0.2.0-main.1175) has only `decide`, `list_history` and `list_inbox`. Revoking a lease uses `LeasesClient.end`.
- Comments and reasons are sent to the server and never logged or printed. Responses carry ids, states and ISO timestamps; requester names and emails and request reasons are never written.

## bw serve

| Route                                      | Body                                                 |
| ------------------------------------------ | ---------------------------------------------------- |
| `GET /pam/approval/inbox`                  | `?names=true` is optional                            |
| `GET /pam/approval/history`                | `?names=true` is optional                            |
| `GET /pam/approval/managed-leases`         | `?all=true`, `?names=true` are optional              |
| `POST /pam/approval/:requestId/decide`     | `{ "verdict": "approve" \| "deny", "comment"?: "" }` |
| `POST /pam/approval/:requestId/withdraw`   | `{ "yes": true }`                                    |
| `POST /pam/approval/lease/:leaseId/revoke` | `{ "yes": true, "reason"?: "" }`                     |

## Code

- `bit-common/src/pam/approvals/approver-privileges.ts` and `approver-privilege.service.ts`: the approver predicate and the reader of the synced inputs. `bit-cli/src/pam/approvals/approver-guard.ts` turns a failed check into the refusal.
- `bit-common/src/pam/approvals/approvals.service.ts`: `ApprovalsService`, the row mapping, `deriveManagedLeases` and `settledOutcome`.
- `bit-cli/src/pam/approvals/`: `approvals.program.ts` (commands), `approval-actions.ts` (shared by commands and routes), `approval.response.ts`, `serve.ts`.
