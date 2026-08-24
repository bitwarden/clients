/**
 * Body for `POST /organizations/{orgId}/rotation/configs`.
 * Creates a new rotation configuration linking a vault cipher to a target system.
 *
 * `scheduleCron` is a Quartz 6-field cron expression (e.g. `"0 0 0 * * ?"` for daily at
 * midnight). Pass `null` to create the config with no scheduled rotation. The server enforces
 * a 15-minute minimum interval; the client validates advisorily and surfaces 400s as error
 * toasts.
 */
export class RotationConfigCreateRequest {
  cipherId: string;
  targetSystemId: string;
  accountIdentity: string;
  terminateSessions: boolean;
  scheduleCron: string | null;
  rotateOnAccessEnd: boolean;

  constructor(init: {
    cipherId: string;
    targetSystemId: string;
    accountIdentity: string;
    terminateSessions: boolean;
    scheduleCron: string | null;
    rotateOnAccessEnd: boolean;
  }) {
    this.cipherId = init.cipherId;
    this.targetSystemId = init.targetSystemId;
    this.accountIdentity = init.accountIdentity;
    this.terminateSessions = init.terminateSessions;
    this.scheduleCron = init.scheduleCron;
    this.rotateOnAccessEnd = init.rotateOnAccessEnd;
  }
}
