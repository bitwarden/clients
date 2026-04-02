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

Introduce a `recoverAccount` public orchestrator and extract the existing monolithic
`resetMasterPassword` body into focused private helpers. `resetMasterPassword` becomes a thin
backward-compat wrapper so no other callers need to change.

**New public API:**

```ts
// Request object — avoids long positional param lists
type RecoverAccountRequest = {
  organizationUserId: string;
  organizationId: OrganizationId;
  resetMasterPassword: boolean;
  resetTwoFactor: boolean;
  newMasterPassword?: string; // required when resetMasterPassword is true
  email?: string;             // required when resetMasterPassword is true
};

async recoverAccount(request: RecoverAccountRequest): Promise<void>

// Thin backward-compat wrapper — no callers change
async resetMasterPassword(
  newMasterPassword: string,
  email: string,
  orgUserId: string,
  orgId: OrganizationId,
): Promise<void> {
  return this.recoverAccount({
    organizationUserId: orgUserId,
    organizationId: orgId,
    resetMasterPassword: true,
    resetTwoFactor: false,
    newMasterPassword,
    email,
  });
}
```

**Private helpers extracted from the existing method body:**

- `buildKdfConfig(response)` — constructs `PBKDF2KdfConfig` or `Argon2KdfConfig` from the API
  response fields
- `decryptUserKey(response, orgId)` — fetches org sym key, unwraps private key, decapsulates user
  key; returns `UserKey`
- `buildResetPasswordRequestV2(password, email, kdfConfig, userKey)` — new-API path (feature flag
  `PM27086_UpdateAuthenticationApisForInputPassword`): builds `OrganizationUserResetPasswordRequest`
  via `newConstructor`
- `buildMasterPasswordRequest(password, email, kdfConfig, userKey)` — legacy path: makes master key,
  hashes it, wraps user key, returns request
- `recoverAccount` (orchestrator): validates flags, calls `decryptUserKey` + one of the two request
  builders only when `resetMasterPassword` is true, sets boolean flags on request, calls
  `putOrganizationUserRecoverAccount`

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
  - Call `resetPasswordService.recoverAccount({ organizationUserId, organizationId, resetMasterPassword, resetTwoFactor, newMasterPassword: password, email })`.
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

## Test Coverage

### `organization-user-reset-password.service.spec.ts` (existing file — update)

- Update mocks: replace `putOrganizationUserResetPassword` spy with `putOrganizationUserRecoverAccount`.
- Add test cases for `recoverAccount`:
  - `resetMasterPassword: true, resetTwoFactor: false` → calls crypto helpers, sends request with
    correct fields, calls new endpoint.
  - `resetMasterPassword: false, resetTwoFactor: true` → skips all crypto, sends minimal request,
    calls new endpoint.
  - Both `true` → crypto runs and both flags are true in request.
  - Both `false` → throws or resolves immediately without calling API (validator logic).
- Add test for `resetMasterPassword` backward-compat wrapper → delegates to `recoverAccount` with
  correct shape.
- Add unit tests for each private helper (`buildKdfConfig`, `decryptUserKey`,
  `buildMasterPasswordRequest`, `buildResetPasswordRequestV2`) to validate their behavior in
  isolation.

### `account-recovery-dialog.component` (new spec file)

- Test that the 2FA checkbox is hidden when `AdminResetTwoFactor` feature flag is `false`.
- Test that the 2FA checkbox is visible when the flag is `true`.
- Test that the Save button is disabled (or shows error) when both checkboxes are unchecked.
- Test that the password input is hidden when "Reset master password" is unchecked.
- Test that submit calls `recoverAccount` with the correct flag combination.

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
