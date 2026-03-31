# Plan: Add 2FA Reset to Admin Console Account Recovery Dialog

## Context

Server PR bitwarden/server#7139 adds a new `/recover-account` endpoint that allows org admins to
optionally reset a member's **master password**, their **two-step login (2FA)**, or both in a single
request. The existing `/reset-password` endpoint only handles passwords. The frontend needs to
surface both options in the existing `AccountRecoveryDialogComponent`, guard the 2FA option with the
`AdminResetTwoFactor` feature flag, and wire up the new API endpoint.

**Figma design** (already reviewed): Shows two checkboxes inside the existing dialog:

- "Reset master password" (checked by default) → reveals the existing password input
- "Reset two-step login" (unchecked by default) → shows helper text "The member's access will be
  revoked until they set up two-step login"

Title changes from "Recover account" + name subtitle → "Recover account for {email}" (full title).
Warning callout is replaced with plain text.

---

## Files to Modify

### 1. Feature flag — `libs/common/src/enums/feature-flag.enum.ts`

- Add under `/* Admin Console Team */`:
  ```ts
  AdminResetTwoFactor = "pm-15489-admin-reset-two-factor",
  ```
- Add default value `FALSE` in `DefaultFeatureFlagValue`:
  ```ts
  [FeatureFlag.AdminResetTwoFactor]: FALSE,
  ```

### 2. Request model — `libs/admin-console/src/common/organization-user/models/requests/organization-user-reset-password.request.ts`

Add two new fields:

```ts
resetMasterPassword: boolean = true; // default true for backward compat
resetTwoFactor: boolean = false;
```

Update `newConstructor` to also set `resetMasterPassword = true`.

### 3. API abstraction — `libs/admin-console/src/common/organization-user/abstractions/organization-user-api.service.ts`

Add new abstract method:

```ts
abstract putOrganizationUserRecoverAccount(
  organizationId: string,
  id: string,
  request: OrganizationUserResetPasswordRequest,
): Promise<void>;
```

### 4. API implementation — `libs/admin-console/src/common/organization-user/services/default-organization-user-api.service.ts`

Implement the new method calling the new server route:

```ts
putOrganizationUserRecoverAccount(orgId, id, request): Promise<void> {
  return this.apiService.send(
    "PUT",
    `/organizations/${orgId}/users/${id}/recover-account`,
    request, true, false,
  );
}
```

### 5. Reset password service — `apps/web/src/app/admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service.ts`

Rename/extend `resetMasterPassword` to `recoverAccount` (keep `resetMasterPassword` as a thin
wrapper for now to avoid breaking the key-rotation usages, or update all call sites):

New signature:

```ts
async recoverAccount(
  organizationUserId: string,
  organizationId: OrganizationId,
  resetMasterPassword: boolean,
  resetTwoFactor: boolean,
  newMasterPassword?: string,
  email?: string,
): Promise<void>
```

Logic:

- If `resetMasterPassword` is true → run existing crypto, populate `request.key` /
  `request.newMasterPasswordHash` (existing two code paths for feature flag
  `PM27086_UpdateAuthenticationApisForInputPassword` stay unchanged).
- Set `request.resetMasterPassword = resetMasterPassword` and `request.resetTwoFactor =
resetTwoFactor` on the request.
- Call `organizationUserApiService.putOrganizationUserRecoverAccount(...)` (new endpoint) instead of
  the old `putOrganizationUserResetPassword`.
- If only `resetTwoFactor = true` (no password reset): skip all crypto, build a minimal request with
  just the boolean flags, call the new endpoint.

### 6. Dialog TypeScript — `apps/web/src/app/admin-console/organizations/members/components/account-recovery/account-recovery-dialog.component.ts`

Changes:

- Inject `ConfigService` to check `AdminResetTwoFactor` feature flag.
- Add reactive form or simple booleans:
  ```ts
  resetMasterPassword = true;
  resetTwoFactor = false;
  adminResetTwoFactorEnabled$ = this.configService.getFeatureFlag$(FeatureFlag.AdminResetTwoFactor);
  ```
- Update `handlePrimaryButtonClick`:
  - If `!resetMasterPassword && !resetTwoFactor` → show validation error (at least one must be selected).
  - If `resetMasterPassword` → call `inputPasswordComponent.submit()` as before.
  - Call `resetPasswordService.recoverAccount(orgUserId, orgId, resetMasterPassword, resetTwoFactor, password, email)`.
  - Update success toast to use new i18n key `recoverAccountSuccess`.
- Import `CheckboxModule`, `FormFieldModule` from `@bitwarden/components`.

### 7. Dialog template — `apps/web/src/app/admin-console/organizations/members/components/account-recovery/account-recovery-dialog.component.html`

Per Figma:

- Title: `"recoverAccountFor" | i18n: dialogData.email` (no subtitle needed).
- Replace `<bit-callout>` with `<p>{{ "recoverAccountWarning" | i18n }}</p>`.
- Add "Reset master password" `<bit-checkbox>` bound to `resetMasterPassword`.
- Wrap existing `<auth-input-password>` in `*ngIf="resetMasterPassword"`.
- Below the password input, add "Reset two-step login" `<bit-checkbox>` wrapped in
  `*ngIf="adminResetTwoFactorEnabled$ | async"`, bound to `resetTwoFactor`, with helper text.

### 8. i18n — `apps/web/src/locales/en/messages.json`

Add new keys (near existing `recoverAccount` group):

```json
"recoverAccountFor": {
  "message": "Recover account for $EMAIL$",
  "placeholders": { "email": { "content": "$1", "example": "user@example.com" } }
},
"recoverAccountWarning": {
  "message": "When you reset the password or two-step login for this member, they'll be notified of the change and logged out."
},
"resetMasterPassword": {
  "message": "Reset master password"
},
"resetTwoStepLogin": {
  "message": "Reset two-step login"
},
"resetTwoStepLoginDesc": {
  "message": "The member's access will be revoked until they set up two-step login"
},
"recoverAccountSuccess": {
  "message": "Account recovery success!"
}
```

---

## Key Reuse

- Existing `InputPasswordComponent` at `@bitwarden/auth/angular` — keep as-is, just conditionally render
- Existing `masterPasswordPolicyOptions$` — keep as-is
- `putOrganizationUserResetPassword` — leave untouched for backward compat (key rotation still uses it)
- Feature flag pattern from `configService.getFeatureFlag$(FeatureFlag.X)` — same as elsewhere in the app
- `@bitwarden/components` `CheckboxModule` — already used in sibling components in the members module

---

## Verification

1. **Feature flag off** (default): Dialog looks and behaves exactly as today — only password reset, no 2FA checkbox visible.
2. **Feature flag on**: Dialog shows both checkboxes.
   - "Reset master password" checked + "Reset two-step login" unchecked → existing password reset flow, new endpoint.
   - "Reset master password" unchecked + "Reset two-step login" checked → no password input shown, submit sends `{ resetMasterPassword: false, resetTwoFactor: true }` to new endpoint.
   - Both checked → password input shown, both flags true.
   - Neither checked → "Save" disabled or shows inline validation error.
3. Run existing unit tests: `organization-user-reset-password.service.spec.ts` — update mocks for the new `putOrganizationUserRecoverAccount` method.
4. Manual test against local server with the feature flag enabled.
