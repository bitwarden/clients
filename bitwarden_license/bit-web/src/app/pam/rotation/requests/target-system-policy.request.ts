import { PasswordPolicy } from "../rotation";

/**
 * Body for `PUT /organizations/{orgId}/rotation/target-systems/{targetSystemId}/policy`.
 * Updates the password policy for a target system. `supportsSessionTermination` applies only to
 * Automatic systems; for Manual systems it is sent as `false` and ignored by the server (a manual
 * rotation has no daemon session to terminate).
 *
 * Note: `supportsSessionTermination` withdrawal may be rejected by the server when active
 * rotation configs rely on session termination. The UI should surface a warning callout before
 * submit when the operator is unchecking this flag.
 */
export class TargetSystemPolicyRequest {
  passwordPolicy: PasswordPolicy;
  supportsSessionTermination: boolean;

  constructor(init: { passwordPolicy: PasswordPolicy; supportsSessionTermination: boolean }) {
    this.passwordPolicy = init.passwordPolicy;
    this.supportsSessionTermination = init.supportsSessionTermination;
  }
}
