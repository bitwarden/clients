import { PasswordPolicy, TargetSystemKind, TargetSystemMethod } from "../rotation";

/**
 * Body for `POST /organizations/{orgId}/rotation/target-systems`.
 *
 * The request is method-discriminated:
 * - `Manual` — `name`, `method`, and `passwordPolicy` are sent (the policy is the set of rules the
 *   operator follows when rotating by hand); `kind` and `supportsSessionTermination` are omitted
 *   (no daemon runs a manual rotation, so there is no integration or session to terminate).
 * - `Automatic` — `kind`, `passwordPolicy`, and `supportsSessionTermination` are all
 *   **required** by the server and must be provided.
 */
export class TargetSystemCreateRequest {
  name: string;
  method: TargetSystemMethod;
  kind?: TargetSystemKind;
  passwordPolicy?: PasswordPolicy;
  supportsSessionTermination?: boolean;

  constructor(init: {
    name: string;
    method: typeof TargetSystemMethod.Manual;
    passwordPolicy: PasswordPolicy;
  });
  constructor(init: {
    name: string;
    method: typeof TargetSystemMethod.Automatic;
    kind: TargetSystemKind;
    passwordPolicy: PasswordPolicy;
    supportsSessionTermination: boolean;
  });
  constructor(init: {
    name: string;
    method: TargetSystemMethod;
    kind?: TargetSystemKind;
    passwordPolicy?: PasswordPolicy;
    supportsSessionTermination?: boolean;
  }) {
    this.name = init.name;
    this.method = init.method;
    this.passwordPolicy = init.passwordPolicy;
    if (init.method === TargetSystemMethod.Automatic) {
      this.kind = init.kind;
      this.supportsSessionTermination = init.supportsSessionTermination;
    }
    // Manual: integration kind + session termination are intentionally omitted.
  }
}
