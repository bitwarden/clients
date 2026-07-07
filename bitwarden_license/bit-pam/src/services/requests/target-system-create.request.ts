import { PasswordPolicy, TargetSystemKind, TargetSystemMethod } from "../../abstractions/rotation";

/**
 * Body for `POST /organizations/{orgId}/rotation/target-systems`.
 *
 * The request is method-discriminated:
 * - `Manual` — only `name` and `method` are sent; `kind`, `passwordPolicy`, and
 *   `supportsSessionTermination` must be omitted (server rejects them).
 * - `Automatic` — `kind`, `passwordPolicy`, and `supportsSessionTermination` are all
 *   **required** by the server and must be provided.
 */
export class TargetSystemCreateRequest {
  name: string;
  method: TargetSystemMethod;
  kind?: TargetSystemKind;
  passwordPolicy?: PasswordPolicy;
  supportsSessionTermination?: boolean;

  constructor(init: { name: string; method: typeof TargetSystemMethod.Manual });
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
    if (init.method === TargetSystemMethod.Automatic) {
      this.kind = init.kind;
      this.passwordPolicy = init.passwordPolicy;
      this.supportsSessionTermination = init.supportsSessionTermination;
    }
    // Manual: automatic-only fields are intentionally omitted.
  }
}
