# QA Run Plan: Key rotation — organization fingerprint trust dialog fix

## Change Summary

**Type:** Bug Fix

**Description:** During account encryption key rotation, the fingerprint trust dialog for
organizations did not display. This meant a user rotating their account key while belonging to
one or more organizations was not shown the per-organization public-key trust verification step
before rotation proceeded. This has been fixed.

**Touched surface (for context):**

- `apps/web/src/app/key-management/key-rotation/key-rotation.component.ts` — entry point button
- `libs/key-management-ui/src/key-rotation/key-rotation-dialog.component.ts` — master
  password/KDF entry dialog
- `libs/key-management-ui/src/key-rotation/key-rotation-trust-info.component.ts` — intro "verify
  trust" dialog, gated on `organizations.length > 0 || emergencyAccessGrantees.length > 0`
- `libs/key-management-ui/src/trust/account-recovery-trust.component.ts` — the per-organization
  fingerprint/public-key trust dialog (this is the dialog that was not appearing)
- `apps/web/src/app/key-management/key-rotation/user-key-rotation.service.ts` /
  `libs/key-management-ui/src/trust/default-user-crypto-dialog.service.ts` — orchestration
  (`verifyTrust`)

## Test Cases

### 1. Fix verification: organization member sees the fingerprint trust dialog during key rotation

**Covers:** Repro-then-fix verification (primary case for this bug fix).

**Environmental pre-conditions:**

- Account is a member of at least one organization.
- User is logged in and unlocked, on the web client.

**Steps:**

1. Navigate to **Settings > Security > Keys**.
2. Click **Rotate account encryption key**.
3. Enter master password / complete the KDF prompt in the `KeyRotationDialogComponent`.
4. Observe that the trust-info intro dialog (`key-rotation-trust-info.component`) appears.
5. Accept/continue past the intro dialog.
6. Observe that the per-organization fingerprint trust dialog
   (`account-recovery-trust.component`) appears for the organization membership.
7. Accept the fingerprint/trust prompt.
8. Allow rotation to complete.

**Assertions:**

- **UI:** Screenshot confirms the `account-recovery-trust.component` fingerprint dialog is shown
  after the intro dialog and before rotation proceeds (this is the behavior that was previously
  broken — it must now appear).
- **API:** The account key rotation request (recorded during the run) is only sent after the
  trust dialog is accepted — confirms trust verification is not bypassed.
