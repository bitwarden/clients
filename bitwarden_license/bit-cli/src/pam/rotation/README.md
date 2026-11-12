# bw pam rotation

Rotation configs, the managed credentials of an organization. Each links a vault cipher to a target system. Admin commands. Needs the `Pam` and `PamAccessConnector` flags and `ManageRotation` rights (the same gate as connectors and targets). An organization that is not yours, or that does not use Privileged Controls, is refused for every command that takes `--organizationid` before any SDK call, with "Organization not found, or you are not a member of it." or "This organization does not use Privileged Controls."; provider users are refused too. Built on the SDK's `rotation().configs()` and `rotation().schedule()` clients, through `RotationService` in `bit-common/src/pam/rotation`.

| Command                                                                                                  | Does                                                          |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `rotation list --organizationid <id> [--names]`                                                          | Lists configs, with their action flags.                       |
| `rotation get <configId> --organizationid <id> [--jobs <n>] [--names]`                                   | One config, its action flags and its newest jobs (default 5). |
| `rotation create (<json> \| --file <path> \| --stdin) --organizationid <id> [--schedule <preset\|cron>]` | Creates a config.                                             |
| `rotation update <configId> (<json> \| --file <path> \| --stdin) --organizationid <id> [--schedule ...]` | Re-seals the whole config.                                    |
| `rotation delete <configId> --organizationid <id> --yes`                                                 | Removes the link and its history only.                        |
| `rotation pause \| resume <configId> --organizationid <id>`                                              | Stops or restarts new rotation jobs.                          |
| `rotation rotate <configId> --organizationid <id> --yes`                                                 | Dispatches a rotation now.                                    |
| `rotation record-manual <configId> --organizationid <id>`                                                | Records an out-of-band rotation of a manual target.           |
| `rotation actions <configId> --organizationid <id>`                                                      | Shows the action flags.                                       |
| `rotation schedule <preset\|cron>`                                                                       | Resolves a schedule. Offline, needs no organization.          |

## Request

`{ cipherId, targetSystemId, accountIdentity, terminateSessions, scheduleCron?, rotateOnAccessEnd }`, as inline JSON, `--file` or `--stdin` (exactly one). `accountIdentity` is sensitive, so prefer `--file` or `--stdin`, which keep it out of shell history. Unknown fields are refused. On `create`, `terminateSessions` and `rotateOnAccessEnd` default to `false`. On `update`, any field left out keeps its current value, which is read in-process and never printed. `cipherId` and `targetSystemId` must match the existing config.

## Schedule

`--schedule` takes a preset (`none`, `hourly`, `every6_hours`, `daily`, `weekly`, `monthly`), resolved with `cron_for_preset`, or a raw Quartz cron, passed through unchanged. `is_likely_quartz_cron` only adds a warning to `rotation schedule`; the server decides validity. `--schedule` overrides `scheduleCron` in the JSON. A schedule can change while a rotation is active.

## Guards and refusals

- `rotate`, `pause`, `resume` and `record-manual` first read the config and check `actions()`. A refusal says why and sends nothing. The target's status is not passed, so a disabled target is left to the server.
- `update` refuses account changes (`accountIdentity`, `terminateSessions`) while `mutationsLocked`, and `delete` refuses while `mutationsLocked`.
- `rotate` is limited by a server cooldown. A 429, or a 409 with no recognised text, is reported as a cooldown. `rotate` and `delete` need `--yes`.
- `record-manual` applies only to manual-method targets.

## Output

`pam-rotation-config` (flat, plus `jobs` on `get`), `pam-rotation-job`, `pam-rotation-schedule` and `pam-rotation-action`. The `jobs` array of `get` is the one deviation from "flat fields": it holds flat job objects. Cipher ids are printed. `--names` adds `cipherName` from the synced vault when it is there (gated ciphers are not synced).

Never printed: `accountIdentity` and other sealed fields (only `accountIdentitySet`). `targetSystemName` and `failureReason` are server text and are cleaned with `sanitizeUntrusted`. A job shows `failureCode`; `failureReason` is shown only when there is no usable code, and is cut to 120 characters.

## bw serve

Read-only: `GET /pam/rotation?organizationid=`, `GET /pam/rotation/:configId?organizationid=` and `GET /pam/rotation/schedule/:value`. Mutations are commander-only, because they carry the account identity and the destructive ones need `--yes`. `list` and `get` make the same `ManageRotation` pre-check as the commands; the server stays the authority. `schedule` needs no organization.

## Known gaps

- Not tested against a live server (local login is blocked). The preset set and the cooldown mapping come from the SDK typings and a guess at the server status, not a live run.
- `rotation-server.allium` is not in this repo and was not used.
