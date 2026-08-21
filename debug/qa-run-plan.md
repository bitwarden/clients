# QA Run Plan: Old attachments in the Data Diagnostics Tool

## Change under test

**Type:** Feature (new detection category on an existing tool)

GIVEN a user has an old attachment, WHEN the user navigates to the diagnostics tool and begins the
process, THEN old attachments are shown as a problem in the on-screen output and the specific
cipher IDs are written as individual log lines in the diagnostic tool log file.

"Old attachment" means an attachment created before December 2018, which uses the earlier
encryption method. Bitwarden flags these in the vault list and offers an upgrade that downloads,
re-encrypts, re-uploads, and deletes the old version. See
https://bitwarden.com/help/attachments/.

## Product reference

- Data Recovery and Diagnostics Tool: https://bitwarden.com/help/data-recovery-and-diagnostics-tool/
- Confluence (CSKB): https://bitwarden.atlassian.net/wiki/spaces/CSKB/pages/2865266742/Data+Diagnostics+Recovery+Tool
- Attachments: https://bitwarden.com/help/attachments/

The tool performs a full sync and then attempts to decrypt the private key, folders, and vault
items. It renders a progress checklist, offers repair for detected issues, and exposes a save
action for the diagnostic log. Logs live in memory only and are lost on refresh or navigation
unless saved. Per the Help Center, the log contains user and item identifiers and encryption
version information, and must not contain key material, password data, or PII.

## Shared environment

These apply to every test case unless a case overrides them.

| Item         | Value                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Client       | Web only. The tool does not exist on desktop, browser extension, or CLI.                                        |
| Route        | `<vault-host>/#/settings/data-recovery`. No sidebar entry exists, so navigate by URL.                           |
| Access       | Requires an authenticated and unlocked account. No org, policy, or premium guard on the route.                  |
| Feature flag | None. There is no flag for this tool, so nothing to toggle via the automation driver.                           |
| Server       | A dev or QA server whose database can be modified, so legacy attachments can be seeded.                         |
| Automation   | Web dev build with the automation driver available. Chrome DevTools on port 9200, `chrome-devtools` MCP prefix. |

### On-screen labels to match against

| Element         | English string                     |
| --------------- | ---------------------------------- |
| Page heading    | Troubleshooting                    |
| Section heading | Data Recovery and Diagnostics      |
| Start button    | Run Diagnostics                    |
| Repair button   | Repair Issues                      |
| Save log button | Save Diagnostic Logs               |
| Step row        | Verifying user information         |
| Step row        | Synchronizing data                 |
| Step row        | Verifying encryption key integrity |
| Step row        | Verifying folder integrity         |
| Step row        | Verifying vault item integrity     |

The saved file is named `data-recovery-logs-<ISO timestamp>.txt` and is plain text.

The label for the new old-attachment row and the wording of the new problem output are not yet
known. Confirm both with the developer before the first run and record the exact strings here, so
the assertions match on text rather than on position in the list.

### Manual pre-condition: seeding legacy attachments

**This cannot be automated.** Per the QA notes, the developer on this story recreates old
attachments directly in the database. Before each case that needs them, ask the developer to seed
the attachments and to hand over the affected cipher IDs, since the assertions compare against
those exact IDs.

Capture the expected cipher IDs one of two ways:

1. Open the item in the vault and read `itemId` from the URL.
2. Read the sync response recorded during the run and pull the IDs of the ciphers carrying
   attachments.

### Reading the diagnostic log file

Preferred: click **Save Diagnostic Logs**, then read the downloaded
`data-recovery-logs-*.txt` from the Chrome download directory and assert against its contents.

Fallback, if downloads are not reachable from the automation environment: assert against the
on-screen log output rendered by the tool. Note in the run summary which of the two was used,
because only the first one actually exercises the saved file.

---

## Test case 1: Old attachment is reported on screen and logged per cipher

**Covers:** core acceptance criteria, both halves of the THEN clause.
**Assertion method:** UI and log file.

### Pre-conditions

- One personal vault item with exactly one legacy attachment, seeded by the developer.
- The item decrypts normally in the vault, so the finding is attributable to the attachment and
  not to a corrupted cipher.
- The cipher ID of that item is recorded before the run.

### Steps

1. Open the web client and confirm the vault is unlocked.
2. Open the vault item that carries the legacy attachment and confirm the vault list shows the
   old-attachment alert marker on it.
3. Navigate to `#/settings/data-recovery` and confirm the Data Recovery and Diagnostics section is
   shown.
4. Click Run Diagnostics and wait for every step row to reach a terminal state.
5. Assert the on-screen output reports old attachments as a problem, using the wording confirmed
   with the developer.
6. Assert the problem output identifies one affected item and that the count matches the single
   seeded attachment.
7. Assert the step rows for user information, sync, encryption key integrity, and folder integrity
   all pass, so the only reported problem is the attachment.
8. Click Save Diagnostic Logs and confirm a file named `data-recovery-logs-<timestamp>.txt` is
   produced.
9. Assert the log file contains a log line for the seeded cipher ID.
10. Assert that cipher ID appears on its own line rather than being merged into a summary line, so
    the individual-log requirement is met.
11. Assert the log file contains no attachment filename, no item name, and no decrypted field
    values.

---

## Test case 2: Modern attachments work and produce no old-attachment finding

**Covers:** false-positive guard on the new detection, plus a regression pass on the attachment
feature itself.
**Assertion method:** UI.

### Pre-conditions

- An account with no legacy attachments anywhere in the personal vault.
- The account can add attachments, so a premium or org-backed test account.
- A small local test file to upload.

### Steps

1. Open the web client and confirm the vault is unlocked.
2. Create or open a personal vault item and attach the test file.
3. Confirm the attachment is listed on the item and that no old-attachment alert marker is shown
   for it.
4. Download the attachment and confirm the downloaded file opens and matches the file that was
   uploaded, which proves current-encryption attachments still decrypt.
5. Navigate to `#/settings/data-recovery`.
6. Click Run Diagnostics and wait for every step row to reach a terminal state.
7. Assert every step row passes and that the on-screen output reports no old-attachment problem.
8. Assert the Repair Issues button is not shown, since there are no issues to repair.
9. Click Save Diagnostic Logs and assert the log file contains no per-cipher old-attachment log
   lines.
10. Delete the attachment from the item and confirm it is removed, which closes out the attachment
    regression pass.

---

## Test case 3: Org-owned cipher with an old attachment

**Covers:** scoping of the new detection against the tool's existing organization exclusion.
**Assertion method:** UI and log file.

### Pre-conditions

- An organization the test account belongs to, on a plan that permits attachments.
- One organization-owned vault item with a legacy attachment, seeded by the developer.
- Optionally one personal item with a legacy attachment in the same account, so the run shows
  whether personal and org items are treated differently in a single pass.
- The cipher IDs of both seeded items are recorded before the run.

### Steps

1. Open the web client and confirm the vault is unlocked and the organization is visible.
2. Open the organization-owned item and confirm the vault list shows the old-attachment alert
   marker on it.
3. Navigate to `#/settings/data-recovery`.
4. Click Run Diagnostics and wait for every step row to reach a terminal state.
5. Record whether the on-screen output reports the organization-owned item as a problem.
6. Click Save Diagnostic Logs and record whether the organization-owned cipher ID appears as a log
   line.
7. Assert the on-screen output and the log file agree, meaning the org item is either reported in
   both or absent from both, with no case where it is counted on screen but missing from the log or
   the reverse.
8. If a personal legacy attachment was also seeded, assert its cipher ID is reported and logged, so
   an org exclusion does not suppress personal findings in the same run.
9. Record the observed behavior and confirm with the developer that it is intended.

**Note for the reviewer:** the existing vault-item step deliberately excludes organization-owned
ciphers. Whether the new attachment detection inherits that exclusion is the open question this
case answers. Either outcome can be correct; the defect this case catches is an inconsistency
between the on-screen output and the log file, or a silent behavior change to the existing
exclusion.

---

## Out of scope for this plan

Dropped during test case selection, recorded so the reasoning is not lost.

- Repair Issues behavior when an old attachment is the only finding.
- Accounts with a large number of legacy attachments, for timeout and log truncation.
- Running the vault's attachment upgrade flow and re-running diagnostics to confirm the finding
  clears.
- A dedicated PII sweep over the log file. Case 1 step 11 covers a narrow version of this.
