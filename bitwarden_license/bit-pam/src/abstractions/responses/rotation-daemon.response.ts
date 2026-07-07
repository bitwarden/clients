import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import type { DaemonStatus } from "../rotation";

/**
 * One row from GET /organizations/{orgId}/rotation/daemons.
 *
 * Mirrors the server's `PamDaemonResponseModel`
 * (bitwarden/server `Bit.Services.Pam.Rotation.Api.Models.Response`).
 * The `status` field is a numeric tinyint matching the `DaemonStatus` const-object values
 * in `../rotation`. Wire property names are PascalCase.
 */
export class RotationDaemonResponse extends BaseResponse {
  /** The daemon's stable identifier (UUID). */
  id: string;
  /**
   * Human-readable display name.
   * Stored plaintext (not encrypted) — see plan risk note: daemon name is a server column
   * rather than vault data; audit snapshots also capture the name as plaintext.
   */
  name: string;
  /**
   * Lifecycle state of this daemon.
   * 0 = Enrolled (active, can be assigned); 1 = Revoked (permanently disabled).
   */
  status: DaemonStatus;
  /**
   * Whether the daemon has an active connection to the rotation relay right now.
   * Reflects the server's real-time presence check; may lag by the polling interval.
   */
  isConnected: boolean;
  /**
   * IDs of the target systems currently assigned to this daemon.
   * Each element is a `TargetSystemResponse.id`.
   */
  assignments: string[];

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.status = this.getResponseProperty("Status");
    this.isConnected = Boolean(this.getResponseProperty("IsConnected"));
    const assignments = this.getResponseProperty("AssignedTargetSystemIds");
    this.assignments = Array.isArray(assignments) ? assignments.map(String) : [];
  }
}
