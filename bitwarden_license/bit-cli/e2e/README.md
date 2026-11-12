# `bw privileged-controls` end-to-end test

`pam.e2e.mjs` drives the built commercial CLI against a **local** Bitwarden server and checks the
Privileged Controls flows for end users and admins. It is a manual, opt-in check, not part of
`npm test`: it needs a running local stack and seeded accounts.

It runs as five users (isolated CLI data directories, deleted at the end): an owner, an admin, a
member, a reports-only custom member, and the owner of an organization without Privileged Controls.

## What it covers

| Area                 | Checks                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Entitlements      | `pam status` per role, `usePam=false` organizations, refusal of PAM commands there                                                                                                                         |
| B. Rules             | permission refusals, create, get, list, disable and enable, `--yes` on destructive actions, CIDR validation, bypassable collections                                                                        |
| C. Request and lease | request (reason required), inbox visibility, self-approval refused, approve, early activation refused, activate, lease list (including `--active`), reveal, extend (one per lease), managed leases, revoke |
| D. Deny and cancel   | deny needs a comment, requester cancel, approval history                                                                                                                                                   |

Not covered: `bw serve` routes, connectors, targets and rotation. Audit and governance are not part of the CLI.

## Run it

Build the CLI first (`npm run build:bit` in `apps/cli`), then:

```bash
PAM_E2E_PASSWORD=<password of the seeded accounts> \
PAM_E2E_ORG_ID=<organization id with Privileged Controls, lowercase> \
PAM_E2E_OTHER_ORG_ID=<organization id without it> \
node bitwarden_license/bit-cli/e2e/pam.e2e.mjs
```

Optional: `PAM_E2E_API` (must be localhost), `PAM_E2E_IDENTITY`, `PAM_E2E_WEB_VAULT`,
`PAM_E2E_CLI`, `PAM_E2E_COLLECTION` (default `Engineering/Cloud Infrastructure`),
`PAM_E2E_REPORT_DIR`, and `PAM_E2E_OWNER`, `_ADMIN`, `_USER`, `_CUSTOM`, `_OTHER` for the emails.

The target collection must exist, hold a cipher, be visible to the member, and have **no** access
rule. The script creates its own uniquely named rule and refuses to start when another rule already
governs the collection. It cancels its requests, ends its leases and deletes its rule at the end,
and never touches rules it did not create.

## Output

One `PASS`, `FAIL` or `SKIP` line per check, `NOTE` lines for observations that need a person to
decide (they are not assertions), and a JSON report at `<report dir>/report.json`. The exit code is
`0` when nothing failed, `1` on a failure or setup error and `2` on missing configuration.

Revealed secrets are measured by length and never printed or written to the report.
