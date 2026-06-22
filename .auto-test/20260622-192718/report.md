# Auto-Test Report — Desktop PIN lock mode

Run ID: `20260622-192718`
Branch: `km/auto-test`
Tested: Desktop (Electron) dev build, attached via Chrome DevTools MCP on `:9222`.

## Change under test

Desktop Account Security settings previously exposed only an "Unlock with PIN" toggle. The PIN lock
mode — whether the master password is required on app restart (`AfterFirstUnlock`) vs. the PIN
persists across restarts (`BeforeFirstUnlock`) — could be chosen only once, inside the Set-PIN
dialog, with no way to change it afterward. The browser client already exposes a persistent
"Lock with master password on restart" checkbox.

This change adds that checkbox to the desktop settings dialog:

- New `pinLockWithMasterPassword` form control, initialized from `PinService.getPinLockType()`
  (`AfterFirstUnlock` → checked).
- Toggling calls `PinService.setPin(pin, AfterFirstUnlock|BeforeFirstUnlock, userId)`, changing the
  lock mode without removing/re-adding the PIN.
- The checkbox is shown only when a PIN is set and the user has a master password, and is re-synced
  after the Set-PIN dialog closes.

Files: `apps/desktop/src/app/accounts/settings-dialog.component.ts`,
`apps/desktop/src/app/accounts/settings-dialog.component.html`.

## Test steps & results

| #   | Step                                                                                                          | Result                                                                                                                                        | Screenshot                                  |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | App launched locked (PIN unlock)                                                                              | —                                                                                                                                             | `01-lock-screen.png`                        |
| 2   | Unlock with default PIN `1234`, open Settings → Security via `bitwardenMessagingService.send("openSettings")` | New **"Lock with master password on restart"** checkbox renders, indented under "Unlock with PIN" (initially unchecked → `BeforeFirstUnlock`) | `02-settings-security-checkbox-visible.png` |
| 3   | Toggle the checkbox ON                                                                                        | Checkbox becomes checked; no errors                                                                                                           | `03-checkbox-toggled-on.png`                |
| 4   | Close & reopen Settings (re-reads `getPinLockType()`)                                                         | Checkbox **still checked** → change persisted to PIN service                                                                                  | `04-reopened-still-checked.png`             |
| 5   | Toggle the checkbox OFF                                                                                       | Checkbox unchecks; reverse direction works, no errors                                                                                         | `05-toggled-back-off.png`                   |

## Verdict: PASS

- The new control is visible exactly where intended (Security tab, below "Unlock with PIN", shown
  because a PIN and master password are both present).
- Both toggle directions work and the chosen lock mode **persists** across reopening Settings,
  confirming `setPin(...)` / `getPinLockType(...)` are wired correctly.
- No console errors attributable to the change. The only console errors observed are pre-existing
  and unrelated — WebSocket/SignalR `notifications/hub` connection failures against the dev server
  (`vault.usdev.bitwarden.pw`), present independent of this change.

## Unit tests

`apps/desktop/.../settings-dialog.component.spec.ts` — 62/62 passing. Lint clean.
