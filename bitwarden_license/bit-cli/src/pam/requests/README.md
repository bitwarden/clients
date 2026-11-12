# bw pam request

The end user's access requests for controlled (gated) items: see your state, ask for access, start the lease once approved, and track or cancel requests. Part of the commercial CLI only. Conventions are in [`../README.md`](../README.md).

Everything goes through the SDK's `access_requests()` client. Nothing here calls the API directly.

## Commands

| Command                                                                                                                               | SDK call                                                  | Needs a PAM seat |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------- |
| `bw pam request status <cipherId> [--precheck] [--names]`                                                                             | `cipher_access_state` (and `pre_check` with `--precheck`) | No               |
| `bw pam request create <cipherId> [--duration <d>] [--start <iso> --end <iso>] [--reason <text>\|--reasonfile <path>\|--reasonstdin]` | `pre_check`, then `request`                               | Yes              |
| `bw pam request list [--status <s>] [--names]`                                                                                        | `list_mine`                                               | No               |
| `bw pam request get <requestId> [--names]`                                                                                            | `get`                                                     | No               |
| `bw pam request activate <requestId>`                                                                                                 | `activate`                                                | Yes              |
| `bw pam request cancel <requestId>`                                                                                                   | `cancel`                                                  | No               |

Every command needs `FeatureFlag.Pam`, an unlocked vault, and an organization that uses PAM (provider users are refused). "Needs a PAM seat" is the `AccessPam` requirement, checked against any organization the caller belongs to, since these verbs name no organization.

The reason options are `--reason`, `--reasonfile` and `--reasonstdin`, following the shared no-hyphen option style, not `--reason-file`.

## status

Prints the state the SDK reports, as given. `badgeState` is never re-ranked. An `active` badge is flattened to `badgeState: "active"` plus `badgeExpiresAt`. The active lease is applied through `liveActiveLease`: a lease whose window has closed is not reported as live (`activeLeaseLapsed: true`), since nothing announces a lease running out, and extensions are not offered for it.

`--precheck` adds the pre-check view: `approvalMode`, `hasActiveLease`, `defaultDurationSeconds`, `maxDurationSeconds`, `canStartLease` and `slotFreesAt`.

## create

Runs `pre_check` first and picks the path from `approvalMode`. Flags are validated locally before any request, and the refusal never contains the reason.

- Automatic: needs a duration. `--duration` (`30m`, `2h`, `1d`, raw seconds) or, when omitted, the pre-check's default, never above its maximum. An explicit duration above the maximum is refused rather than shortened. A window is refused. A reason is optional. While another member holds the item's single active lease (`canStartLease` is false), the request is still sent and the response carries a warning that does not name the holder.
- Human: needs `--start`, `--end` and a reason. The window is checked locally: the end is after the start, the end is in the future, the span is at most the pre-check's maximum, and at most 365 days. `--duration` is refused.
- `--duration` together with `--start` or `--end`, or only one of `--start` and `--end`, is refused. A date with no offset is UTC.
- A pre-check that reports an active lease, or an approval mode this CLI does not know, is refused.

`create` never mints a lease. The output says so and tells the user to run `activate`.

## activate

Mints the lease for an approved request and prints the lease (`pam-lease`): id, request, cipher, status, window. It never reveals the credential. The server's refusals are mapped through the shared catalog: window not started, window ended, not approved, already used, another active lease on the item (single active lease), and unlicensed.

## list and get

`list` is newest first. Extension requests are folded onto the request that produced the lease they extend (`extensionRequestIds`, `extensionPending`); an extension whose parent is not in the list stays its own row. `--status` is one of `pending`, `approved`, `denied`, `canceled`, `expired`. `canceled` has one L. Activation is not a status: an activated request stays `approved` and shows `producedLeaseId`, `producedLeaseStatus` and `producedLeaseNotAfter`.

`get` prints one request without folding.

Neither prints the reason, the requester's name or email, or a decision's comment. `--names` adds `cipherName` and `organizationName` from the synced vault, to stdout only, and falls back to ids.

## cancel

Cancels your own request while it is pending, or approved and not yet activated. No seat is needed, so a member who lost their seat can still withdraw a request.

## bw serve

Under `/pam`: `GET /request/status/:cipherId[?precheck=true]`, `GET /request[?status=]`, `GET /request/:requestId`, `POST /request/create`, `POST /request/:requestId/activate`, `POST /request/:requestId/cancel`. A `create` body is `{ cipherId, duration?, start?, end?, reason? }`, so the reason never travels in a URL. Routes apply the same seat checks as the commands. There is no `--names` on serve.

## Open item: gated items and the CLI device type

Not yet verified against a running server. The server's partial-cipher support is read from the source only: the CLI device type is not sent gated ciphers, so a gated item is absent from `bw sync` and `bw list items` and `bw get item` answers not found until a lease is active. `status`, `create` and `activate` go through the SDK by id and have not been exercised from the CLI. Until they are, do not promise that `bw get item` shows a gated item before activation, and treat `pre_check`, `request` and `cipher_access_state` as untested from the CLI. Names for gated items fall back to ids.
