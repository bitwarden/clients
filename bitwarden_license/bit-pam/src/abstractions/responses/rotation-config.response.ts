import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import type { TargetSystemMethod } from "../rotation";

/**
 * One row from GET /organizations/{orgId}/rotation/configs — the rotation configuration list item.
 *
 * NOTE: These fields reflect the **planned** server contract (server not yet implemented).
 * `targetSystemMethod` is a numeric tinyint matching the `TargetSystemMethod` const-object
 * values in `../rotation`. Timestamp fields are ISO-8601 strings; null means "not yet occurred".
 * Wire property names are PascalCase.
 */
export class RotationConfigResponse extends BaseResponse {
  /** The rotation config's stable identifier (UUID). */
  id: string;
  /**
   * The vault cipher whose credential is managed by this rotation config.
   * The cipher's decrypted name must be resolved client-side via `OrgCiphersService`.
   */
  cipherId: string;
  /** The target system against which credentials are rotated. */
  targetSystemId: string;
  /**
   * Denormalized display name of the target system at the time the config was last written.
   * Used as a fallback when `TargetSystemsService` has not yet loaded.
   */
  targetSystemName: string;
  /**
   * How the rotation is performed for the associated target system.
   * 0 = Automatic (daemon-driven); 1 = Manual (operator records rotation).
   * Denormalized from the target system at config creation time.
   */
  targetSystemMethod: TargetSystemMethod;
  /**
   * The account identifier within the target system (e.g. username, UPN, or service-account name).
   * Max 500 characters as enforced by the server.
   */
  accountIdentity: string;
  /**
   * When true, the daemon will terminate active sessions for this account after a successful rotation.
   * Only applicable when the target system supports session termination (`supportsSessionTermination`).
   */
  terminateSessions: boolean;
  /**
   * Quartz 6-field cron expression defining the rotation schedule.
   * Null means no scheduled rotation (on-demand or access-end only).
   * The server enforces a minimum 15-minute interval floor.
   */
  scheduleCron: string | null;
  /** When true, the daemon rotates the credential when an access lease ends. */
  rotateOnAccessEnd: boolean;
  /**
   * When false, no new rotation jobs will be dispatched (scheduled or on-demand).
   * In-progress jobs are allowed to complete.
   */
  enabled: boolean;
  /** ISO-8601 timestamp of the most recent completed rotation, or null if never rotated. */
  lastRotationAt: string | null;
  /**
   * ISO-8601 timestamp of the next scheduled rotation, or null when no schedule is set
   * or the config is paused.
   */
  nextRotationAt: string | null;
  /**
   * True when a rotation job is currently active (Pending or Claimed).
   * While true, account mutations and deletion are blocked.
   */
  hasActiveJob: boolean;
  /**
   * True when a Manual-method config is waiting for the operator to record
   * that the rotation has been performed out-of-band.
   */
  awaitingManualRotation: boolean;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.cipherId = this.getResponseProperty("CipherId");
    this.targetSystemId = this.getResponseProperty("TargetSystemId");
    this.targetSystemName = this.getResponseProperty("TargetSystemName");
    this.targetSystemMethod = this.getResponseProperty("TargetSystemMethod");
    this.accountIdentity = this.getResponseProperty("AccountIdentity");
    this.terminateSessions = Boolean(this.getResponseProperty("TerminateSessions"));
    this.scheduleCron = this.getResponseProperty("ScheduleCron") ?? null;
    this.rotateOnAccessEnd = Boolean(this.getResponseProperty("RotateOnAccessEnd"));
    const enabled = this.getResponseProperty("Enabled");
    this.enabled = enabled == null ? true : Boolean(enabled);
    this.lastRotationAt = this.getResponseProperty("LastRotationAt") ?? null;
    this.nextRotationAt = this.getResponseProperty("NextRotationAt") ?? null;
    this.hasActiveJob = Boolean(this.getResponseProperty("HasActiveJob"));
    this.awaitingManualRotation = Boolean(this.getResponseProperty("AwaitingManualRotation"));
  }
}
