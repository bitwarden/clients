# bw pam connector

Admin commands for access connectors, the unattended agents that rotate credentials. They call `rotation().connectors()` on the SDK's PAM client. Conventions are in [`../README.md`](../README.md).

## Commands

| Command                                                                        | Gate                | Notes                                                          |
| ------------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------- |
| `bw pam connector list --organizationid <id>`                                  | uses PAM            |                                                                |
| `bw pam connector get <id> --organizationid <id>`                              | uses PAM            | Adds recent rotation jobs. Failure reasons are untrusted text. |
| `bw pam connector register <name> --organizationid <id> [--token-file <path>]` | `canManageRotation` | Returns a one-time token. No serve route.                      |
| `bw pam connector enable <id> --organizationid <id>`                           | `canManageRotation` |                                                                |
| `bw pam connector disable <id> --organizationid <id>`                          | `canManageRotation` | Reversible. Releases the jobs the connector was running.       |
| `bw pam connector delete <id> --organizationid <id> --yes`                     | `canManageRotation` | Permanent. Needs `--yes`. No serve route.                      |
| `bw pam connector assign <id> <targetSystemId> --organizationid <id>`          | `canManageRotation` | The target id is only checked to be a GUID.                    |
| `bw pam connector unassign <id> <targetSystemId> --organizationid <id>`        | `canManageRotation` | The target id is only checked to be a GUID.                    |

Every command needs `FeatureFlag.Pam` and `FeatureFlag.PamAccessConnector`. `canManageRotation` is separate from rule authority, and provider users are refused. An organization that is not yours, or that does not use Privileged Controls, is refused for every command, reads included, before any SDK call ("Organization not found, or you are not a member of it." or "This organization does not use Privileged Controls."). These are cheap pre-checks; the server stays the authority.

## The registration token

`register` returns a token that the server stores only as a hash, so it cannot be recovered. It is printed to stdout once, also under `BW_RESPONSE` (inside `data.token`) and `BW_RAW` (the bare token), or written with `--token-file` to a new file with mode 0600 and not printed at all. An existing file is never overwritten, and the file is claimed before the connector is registered, so a bad path fails with nothing at stake. If the file cannot be written after registering, the token is printed instead of lost.

Without `--token-file`, `register` refuses to run under `BW_QUIET`, because nothing would be printed and the token would be lost. A warning that the token cannot be recovered goes to stderr (silenced by `BW_QUIET`). The token is never stored, logged, or put in an error. `ConnectorService` takes no logger, and its spec asserts that nothing is logged for a registration.

## Deleting

`delete` is permanent and needs `--yes`. The connector held the plaintext organization key, so deleting it after a suspected compromise is not enough: the organization key still needs to be rotated. `disable` is the reversible stop.

## Serve

`GET /pam/connector?organizationid=`, `GET /pam/connector/:id?organizationid=`, and `POST` to `/pam/connector/:id/enable`, `/disable`, `/assign/:targetSystemId` and `/unassign/:targetSystemId` (with `organizationid` in the query). `register` and `delete` have no route.

## Code

- `bit-common/src/pam/connectors/`: `ConnectorService` and the views. Names and failure reasons are passed through `sanitizeUntrusted`.
- `connectors.program.ts`: the commands. `connector.response.ts`: `pam-connector`, `pam-connector-registration` and `pam-connector-action` objects, with ISO dates.
- `register-token.ts`: the 0600 token file and the stderr warning. `serve.ts`: the routes.
