/**
 * Body for `PUT /organizations/{orgId}/rotation/configs/{configId}/account`.
 * Updates the account identity and session-termination flag for a rotation configuration.
 *
 * These fields are locked while a rotation job is active (`hasActiveJob === true`). The UI
 * must disable this form and show a tooltip ("wait or pause first") when mutations are locked.
 * Use `mutationsLocked()` from `helpers/rotation-config-actions.ts` to check.
 */
export class RotationConfigAccountRequest {
  accountIdentity: string;
  terminateSessions: boolean;

  constructor(init: { accountIdentity: string; terminateSessions: boolean }) {
    this.accountIdentity = init.accountIdentity;
    this.terminateSessions = init.terminateSessions;
  }
}
