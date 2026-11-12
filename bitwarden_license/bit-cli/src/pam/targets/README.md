# bw pam target

Target systems an organization rotates credentials against. Admin commands: they need the `PamAccessConnector` feature flag (besides `Pam`), an unlocked vault, and a caller who may manage rotation in the organization (`PamOrganizationRequirement.ManageRotation`). An organization that is not yours, or that does not use Privileged Controls, is refused before any SDK call, with "Organization not found, or you are not a member of it." or "This organization does not use Privileged Controls."; provider users are refused too. The `bw serve` routes make the same check. The server stays the authority.

Code: this directory (commands, `bw serve` routes) and `bit-common/src/pam/targets/` (request validation, the SDK service and error mapping). The SDK calls are `rotation().target_systems().list`, `create`, `update`, `enable`, `disable` and `delete`.

## Commands

All but `template` need `--organizationid <id>`.

| Command                                                                       | What it does                                          |
| ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| `bw pam target list --organizationid <id>`                                    | Lists target systems.                                 |
| `bw pam target template [--method automatic\|manual]`                         | Prints a request template (default `automatic`).      |
| `bw pam target create (<json>\|--file <path>\|--stdin) --organizationid <id>` | Creates a target system.                              |
| `bw pam target update <id> (<json>\|--file <path>\|--stdin) --organizationid` | Replaces a target system's settings.                  |
| `bw pam target enable <id> --organizationid <id>`                             | Puts a disabled target back into service.             |
| `bw pam target disable <id> --organizationid <id>`                            | Stops new rotation jobs. Jobs in flight keep running. |
| `bw pam target delete <id> --organizationid <id> --yes`                       | Deletes it for good. Needs `--yes`, never prompts.    |

`--stdin` is an addition to the planned surface: it reads the request from standard input. Give exactly one of the JSON argument, `--file` or `--stdin`. Prefer `--file` or `--stdin`, which keep the password policy out of shell history.

## The request

A JSON union on `method`:

- automatic: `{name, kind: "entra" | "custom_script", passwordPolicy, supportsSessionTermination}`
- manual: `{name, passwordPolicy}`

`passwordPolicy` is `{minLength, maxLength, includeUppercase, includeLowercase, includeDigits, includeSymbols}`. Unknown keys are refused, so a typo cannot silently drop a sealed field. An `object` key is ignored, so a printed template can be sent back. Only the kinds the pinned SDK publishes are accepted; the Active Directory kind (PAM-172) is not published yet.

## Behaviour to know

- **create is two steps.** The server registers the row as `pending_seal`, then the SDK seals it. If sealing fails, the error names the pending id and the failed response carries `pendingId`. Retry with `update` and the same request, or run `delete`.
- **update re-seals the whole blob.** Every sealed field must be sent again: `kind`, `passwordPolicy` and `supportsSessionTermination` for automatic, `passwordPolicy` for manual. The CLI reads the only non-sealed values, `name` and `method`, from `list`, so those two may be left out. Update also finishes a `pending_seal` target.
- **Immutable fields.** The method never changes, and the kind cannot change once the blob is verified. The server's refusals map to codes `target-system-method-immutable` and `target-system-kind-immutable`.
- **delete** is refused while a rotation config still names the target (code `target-system-has-rotation-configs`). Delete those first, or `disable` the target. `enable` and `disable` are refused for a `pending_seal` target (`target-system-not-sealed`).
- **disable** leaves in-flight jobs running.

## Output

`list` prints `pam-target-system` objects: `id`, `organizationId`, `name`, `method`, `status` (`active`, `disabled`, `pending_seal`), `sealed` (whether the blob unsealed), `creationDate`, `revisionDate`. The sealed fields (kind, password policy, session termination) are never printed or logged. Errors follow `../README.md`; server text outside the catalog and the three refusals in `bit-common/src/pam/targets/target-system-error.ts` is reduced to its status.

## bw serve

`GET /pam/target?organizationid=`, `GET /pam/target/template?method=`, `POST /pam/target` (body is the request), `POST /pam/target/:id/update`, `POST /pam/target/:id/enable`, `POST /pam/target/:id/disable`, `POST /pam/target/:id/delete` (body must be `{"yes": true}`). The organization is always `?organizationid=`. They apply the same flags and organization check as the commands.
