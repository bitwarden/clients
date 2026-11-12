# bw pam

The `bw pam` commands manage Privileged Controls (PAM) from the command line: access requests, leases, approvals, access rules, and credential rotation. They are part of the commercial CLI only, built from `bitwarden_license/bit-cli`, and are not in the open-source build.

Most commands call the SDK's PAM clients (`sdk.commercial().pam()`). Every call goes through the SDK; the CLI makes no plain HTTP requests. Audit and governance are not part of the CLI yet and will arrive when the SDK exposes clients for them.

## Layout

| Where                            | What                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `bit-cli/src/pam/pam.program.ts` | `PamProgram` defines `bw pam` and mounts every group.                             |
| `bit-cli/src/pam/shared/`        | Helpers every group uses. Edited only by the foundation, never by a group.        |
| `bit-cli/src/pam/<group>/`       | One group's commands and `bw serve` routes, with its own README.                  |
| `bit-common/src/pam/shared/`     | Non-Angular code shared by the groups: SDK access, error decoding, input parsing. |
| `bit-common/src/pam/<group>/`    | One group's non-Angular logic.                                                    |

Neither package may import from `bit-web`. `bit-common` uses relative imports within itself and `import type` for every SDK type, so Jest never loads wasm.

## Groups

| Group        | Directory                               | Notes                                                                    |
| ------------ | --------------------------------------- | ------------------------------------------------------------------------ |
| `requests`   | [`requests/`](./requests/README.md)     |                                                                          |
| `leases`     | [`leases/`](./leases/README.md)         | `lease reveal` returns a secret: no serve route.                         |
| `approvals`  | [`approvals/`](./approvals/README.md)   | Approver commands are not gated on admin rights.                         |
| `rules`      | [`rules/`](./rules/README.md)           | Reads are not gated on admin rights.                                     |
| `connectors` | [`connectors/`](./connectors/README.md) | Needs `PamAccessConnector`. `register` returns a secret: no serve route. |
| `targets`    | [`targets/`](./targets/README.md)       | Needs `PamAccessConnector`.                                              |
| `rotation`   | [`rotation/`](./rotation/README.md)     | Needs `PamAccessConnector`.                                              |
| `status`     | [`status/`](./status/README.md)         |                                                                          |

## Registering a group

A group never edits a shared file. It fills in two stubs in its own directory:

- `bit-cli/src/pam/<group>/index.ts` exports `register<Group>(pam: Command, container: ServiceContainer): void`. `PamProgram` calls it with the `bw pam` command. The function builds the group's program and calls `pam.addCommand(...)`.
- `bit-cli/src/pam/<group>/serve.ts` exports `registerServeRoutes(router: Router, container: ServiceContainer): void`. `BitServeConfigurator.servePam` calls it. It may stay empty.

The names are `registerRequests`, `registerLeases`, `registerApprovals`, `registerRules`, `registerConnectors`, `registerTargets`, `registerRotation`, and `registerStatus`.

A group program extends `PamBaseProgram` and runs every action through `runPam(guard, run)`:

```ts
export class LeasesProgram extends PamBaseProgram {
  command(): Command {
    return new Command("lease")
      .description("Manage your access leases")
      .addCommand(
        new Command("extend")
          .argument("<leaseId>")
          .action(async (leaseId: string, options) => {
            await this.runPam({ requirement: PamOrganizationRequirement.AccessPam }, async (ctx) => {
              const pam = createPamSdkService(this.serviceContainer);
              // ... call pam.run(ctx.userId, (client) => client.leases().extend(...))
              return Response.success(new LeaseResponse(...));
            });
          }),
      );
  }
}
```

## Guard order

`runPam` checks, in order, and exits on the first failure:

1. Feature flags. `FeatureFlag.Pam` always. `FeatureFlag.PamAccessConnector` for connectors, targets and rotation, passed as `guard.flags`. Flags are read from the server configuration and need no unlocked vault.
2. The vault is unlocked (`exitIfLocked`).
3. Cheap organization pre-checks from the synced organization: the organization uses PAM and the caller is not a provider user, then the requirement in `guard.requirement`.

| Requirement         | Use it for                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `UsePam`            | The baseline.                                                                                          |
| `AccessPam`         | Only the verbs that need a seat: `request create`, `request activate`, `lease extend`, `lease reveal`. |
| `ManageAccessRules` | Rule writes.                                                                                           |
| `ManageRotation`    | Connector, target system and rotation config writes.                                                   |

Approver commands and rule reads are not gated on admin permissions. With `--organizationid` the requirement is checked against that organization. Without it, against any organization the caller belongs to.

The pre-checks only turn an obvious refusal into a clear message. The server stays the authority, and a 403, a 404 or a `NotFound` from it is mapped to a clear message by `pamErrorResponse`.

## Output conventions

Every command returns a `Response`, printed by `processResponse`, so `BW_RESPONSE`, `BW_QUIET`, `BW_RAW`, `BW_PRETTY` and `BW_CLEANEXIT` behave as they do everywhere else. Never use `console.log`.

- `object` is a `pam-` discriminator: `pam-request`, `pam-lease`, `pam-rule`, and so on. See `PamObject` in `shared/pam-response.ts`.
- Dates are ISO 8601 UTC strings. Use `isoDate`.
- Fields are flat. Write ids and states, not nested objects.
- `canceled` is spelled with one L.
- Lists are `ListResponse`.
- A failure is `Response.error(text, data)` with a `pam-error` object holding `kind`, and `code`, `variant` and `status` when known, so `--response` consumers can branch without parsing text.

## Exit codes

`0` for success, `1` for any failure, including a refused pre-check, a refused input, and a server refusal. With `BW_CLEANEXIT` set the exit code is always `0`, and the failure is only in the response.

## Secret policy

- Never log, print or return a decrypted vault secret, a key, a token or a sealed field.
- Never write `reason`, `comment`, `accountIdentity`, `failureReason` or any other free text a person or a server supplied into a response or a log. Server text is shown only if it matches the catalog in `bit-common/src/pam/shared/pam-error-catalog.ts`, since other server text can carry filesystem paths. Run anything else through `sanitizeUntrusted`. The one exception is the approver's inbox and history rows, which carry the requester's name and email and the request reason as the web vault shows them, sanitized and capped and never logged.
- `--names` prints decrypted cipher, collection and organization names to stdout, and only there, and only when asked.
- Reasons and comments are never asked for with an interactive prompt. Use `readReasonText`, which reads one of `--reason`, `--reasonfile` or `--reasonstdin`. This keeps them out of shell history when a file or stdin is used, and makes the commands work under `--nointeraction`.
- Only the verbs that cannot be done another way return a secret: `lease reveal` and `connector register`. Neither has a serve route.

## Destructive verbs

A verb that ends a lease, deletes a rule or cannot otherwise be undone needs an explicit `--yes` and never prompts, so it behaves the same under `--nointeraction` and in a script. Add it with `addYesOption` and check it with `requireYes`.

## bw serve

PAM routes are registered under `/pam` by each group's `serve.ts`, with `registerPamServeRoute`.

- They run on the host `bw serve` binds, `localhost` by default. `serve` already refuses a foreign `Host` header and any `Origin`, and PAM adds nothing that widens it.
- `GET` for reads and `POST` for mutations. Nothing else.
- No route returns a secret or writes a file. `lease reveal` and `connector register` have no route, and neither does any verb that saves to disk.
- Reasons and comments travel in a `POST` body, never in a URL.
- A route checks the feature flags and an unlocked vault, then runs the same code as the command. A failure is status 400 with the same `Response` body the OSS routes use.

Serve routes may be left out of a group's first version. Commander commands come first.

## Testing

Specs run without loading wasm. Use the helpers in `bit-common/src/pam/shared/testing/pam-test-helpers.ts`: `createPamSdkTestKit` gives a real `PamSdkService` over a mocked PAM client, and `pamTestOrganization` and `pamTestAccountService` give the active account and organization.

## SDK pin

`@bitwarden/commercial-sdk-internal` and `@bitwarden/sdk-internal` are pinned to `0.2.0-main.1175`. Use only methods in that version's `bitwarden_wasm_internal.d.ts`. `ApprovalsClient.revoke` and the AD `TargetSystemKind` are not in it and must not be used. Target systems use `entra`, `custom_script` and the manual method.
