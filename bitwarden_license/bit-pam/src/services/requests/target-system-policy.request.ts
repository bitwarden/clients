import { PasswordPolicy } from "../../abstractions/rotation";

/**
 * Body for `PUT /organizations/{orgId}/rotation/target-systems/{targetSystemId}/policy`.
 * Updates the password policy and session-termination support for an Automatic target system.
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
