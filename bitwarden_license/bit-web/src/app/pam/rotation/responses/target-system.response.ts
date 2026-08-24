import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import type {
  PasswordPolicy,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
} from "../rotation";

/**
 * One row from GET /organizations/{orgId}/rotation/target-systems.
 *
 * NOTE: These fields reflect the **planned** server contract (server not yet implemented).
 * The server returns numeric tinyints for `method`, `kind`, and `status`, matching the
 * const-object values in `../rotation`. Wire property names are PascalCase.
 */
export class TargetSystemResponse extends BaseResponse {
  /** The target system's stable identifier (UUID). */
  id: string;
  /** Human-readable display name (plaintext org configuration, not vault data). */
  name: string;
  /**
   * How the rotation daemon rotates credentials for this target.
   * 0 = Automatic (daemon-driven); 1 = Manual (operator records the rotation).
   */
  method: TargetSystemMethod;
  /**
   * The concrete integration type; null when the method is Manual (no integration).
   * 0 = Entra; 1 = Mssql; 2 = CustomScript.
   */
  kind: TargetSystemKind | null;
  /**
   * Lifecycle state of this target system.
   * 0 = Active; 1 = Disabled (new rotations blocked, in-progress jobs continue).
   */
  status: TargetSystemStatus;
  /**
   * Password policy constraints applied when generating a rotated credential. For Automatic
   * systems the daemon enforces them; for Manual systems they are the rules the operator follows
   * when rotating by hand. Null only when no policy has been configured.
   */
  passwordPolicy: PasswordPolicy | null;
  /**
   * Whether the target integration supports session termination after rotation.
   * Null when the method is Manual or the server has not yet surfaced this capability.
   */
  supportsSessionTermination: boolean | null;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.method = this.getResponseProperty("Method");
    this.kind = this.getResponseProperty("Kind") ?? null;
    this.status = this.getResponseProperty("Status");
    this.passwordPolicy = this.getResponseProperty("PasswordPolicy") ?? null;
    this.supportsSessionTermination =
      this.getResponseProperty("SupportsSessionTermination") ?? null;
  }
}
