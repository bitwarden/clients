# bw privileged-controls status

Scope: the caller's own PAM readiness, and the governed marker on collections. Read only.

| Command                                                    | Needs                                             |
| ---------------------------------------------------------- | ------------------------------------------------- |
| `bw privileged-controls status [--organizationid <id>]`    | A logged-in user for organizations. Nothing else. |
| `bw privileged-controls collections --organizationid <id>` | `FeatureFlag.Pam`, unlocked vault, `usePam`       |

## status

The one `bw privileged-controls` command that runs with the Pam flag off, and with the vault locked. It makes no
SDK call and no request. It reports:

- `featurePam`, `featurePamAccessConnector`: the flag values this client
  holds. An off flag, or a server config never fetched, is why other commands exit with "This
  command is temporarily unavailable."
- Per organization: `usePam`, `accessPam` (your seat), `providerUser`, `hasProvider`,
  `providerType`, and the hints `canManageAccessRules`, `canManageRotation`, `canAccessEventLogs`,
  `canAccessReports`. The hints come from the synced organization and role; the server decides.

Only ids and booleans are printed, never organization names. Without a login only the flags are
reported (`loggedIn: false`). The response is flat apart from the `organizations` array.

## collections

Lists the organization's collections from the synced vault through the existing CLI collection
service: `id`, `organizationId`, `name`, `hasEnabledAccessRule` (the governed marker). Gated
items are not part of this; it shows collections, not ciphers. It never calls the SDK, and logs
nothing. Names are decrypted vault data and go to stdout only. Only collections in the caller's
synced vault appear; an admin sees the ones the vault holds for them, not every organization collection.

## serve

No routes. `bw serve` PAM routes require the Pam flag, which `status` must work without, and
`collections` is already available as `GET /list/object/org-collections`.

Code: `bit-common/src/pam/status/` (`PamStatusService`, `PamCollectionsService`).
Conventions: [`../README.md`](../README.md).
