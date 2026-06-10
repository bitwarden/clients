/**
 * Body for `POST /ciphers/{id}/lease`. All fields are optional on the wire; the
 * server validates the right shape per outcome (automatic = `durationSeconds`,
 * human = `start` + `end` + required `reason`). Client-side validation lives in
 * the form layer.
 */
export class AccessRequestCreateRequest {
  durationSeconds?: number;
  start?: string;
  end?: string;
  reason?: string;

  constructor(init: { durationSeconds?: number; start?: Date; end?: Date; reason?: string }) {
    this.durationSeconds = init.durationSeconds;
    this.start = init.start?.toISOString();
    this.end = init.end?.toISOString();
    this.reason = init.reason;
  }
}
