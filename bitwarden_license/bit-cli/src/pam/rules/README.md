# bw pam rule

Access rule administration, mounted by `registerRules` as `bw pam rule`. Conventions are in [`../README.md`](../README.md).

| Command                                                         | Needs                      | SDK                                           |
| --------------------------------------------------------------- | -------------------------- | --------------------------------------------- |
| `list --organizationid <id> [--names]`                          | any confirmed member       | `access_rules().list`                         |
| `get <ruleId> --organizationid <id> [--names]`                  | any confirmed member       | `access_rules().get`                          |
| `template`                                                      | feature flag only          | none                                          |
| `create (<json>\|--file <path>) --organizationid <id>`          | `canManageAccessRules`     | `access_rules().create`                       |
| `update <ruleId> (<json>\|--file <path>) --organizationid <id>` | `canManageAccessRules`     | `access_rules().update`, `bypassable_ciphers` |
| `enable <ruleId> --organizationid <id>`                         | `canManageAccessRules`     | `get`, `set_enabled`                          |
| `disable <ruleId> --organizationid <id> --yes`                  | `canManageAccessRules`     | `get`, `set_enabled`, `bypassable_ciphers`    |
| `delete <ruleId> --organizationid <id> --yes`                   | `canManageAccessRules`     | `get`, `bypassable_ciphers`, `delete`         |
| `bypassable <ruleId> --organizationid <id> [--names]`           | any confirmed member       | `bypassable_ciphers`                          |
| `validate-cidr <cidr...>`                                       | feature flag only, offline | `is_valid_cidr`                               |

`canManageAccessRules` is Owner or Admin, or a custom role with `manageAccessRules`, in an organization that uses PAM and where the caller is not a provider user. Reads need no admin right, but every command that takes `--organizationid`, reads included, is refused before any SDK call when the organization is not one of yours ("Organization not found, or you are not a member of it.", which does not reveal whether it exists), does not use Privileged Controls ("This organization does not use Privileged Controls."), or the caller is a provider user. The server decides the rest.

## Request JSON

`create` and `update` take an `AccessRuleAddEditRequest` as JSON, or base64 of JSON as `bw create item` does, from the argument, `--file`, or standard input. `template` prints a valid one. These are checked before anything is sent, as the server checks them (`bit-common/src/pam/rules/access-rule-request.ts`):

- `name` 1 to 256 characters after trim (the trimmed name is sent); at most 10 conditions.
- `ip_allowlist` needs at least one CIDR, and every CIDR must pass the SDK's `is_valid_cidr`.
- Durations are whole seconds, positive and at most 365 days, sent exactly (no preset snapping). `defaultLeaseDurationSeconds` must not exceed `maxLeaseDurationSeconds`. `allowsExtensions` needs a positive `maxExtensionDurationSeconds`.
- `name`, `enabled`, `conditions`, `singleActiveLease`, `allowsExtensions` and `collections` must be stated, so an update never silently re-enables a rule or clears its collections. Unknown fields are refused.
- `collections` is the whole set the rule governs. It replaces the existing set.

A collection can have one rule. `create` and `update` check this against `rule list` and refuse locally; if the list cannot be read the server decides. A server refusal is mapped through the shared error catalog (not found, collections missing, foreign or already governed); text outside the catalog is reduced to its status.

## Disabling, updating and deleting

A disabled or deleted rule stops gating its collections, which become bypass paths. `disable` and `delete` need `--yes` and never prompt. After `disable` and `update` the command runs `bypassable_ciphers` and prints a stderr warning listing collection ids (also `bypassableCollectionIds` in the response). `delete` reads the paths and the rule's collections before the delete, because a deleted rule answers an empty list, and lists them in the warning and in `ungovernedCollectionIds`. A failed bypass read never fails a write that landed. `enable` and `disable` do nothing when the rule is already in that state.

## Output

`pam-rule` is flat: ids, `requiresHumanApproval`, `ipAllowlist`, `collectionIds`, ISO dates. Names print only with `--names` (collection names need a vault decrypt, and gated items fall back to ids). The output is not the request shape; edit a copy of `template` to update.

## bw serve

Routes under `/pam`, with `organizationid` as a query parameter: `GET /rule`, `GET /rule/:ruleId`, `GET /rule/:ruleId/bypassable`; `POST /rule` (body is the rule JSON), `POST /rule/:ruleId` (body is the rule JSON), `POST /rule/:ruleId/enable`, `POST /rule/:ruleId/disable` and `POST /rule/:ruleId/delete` (the last two need body `{"yes": true}`). Reads make the same organization pre-check as the commands (the refusal is a 400 with the message above, and no SDK call is made); writes also run the `canManageAccessRules` pre-check. There is no `--names` over serve.
