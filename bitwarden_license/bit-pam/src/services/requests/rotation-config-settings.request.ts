/**
 * Body for `PUT /organizations/{orgId}/rotation/configs/{configId}/settings`.
 * Updates the schedule and trigger settings for an existing rotation configuration.
 *
 * `scheduleCron` is a Quartz 6-field cron expression; `null` disables scheduled rotation.
 * This endpoint does NOT require the config to be paused first — mutations to settings are
 * permitted while a job is active. (Account identity mutations are locked while a job runs;
 * use {@link RotationConfigAccountRequest} for those.)
 */
export class RotationConfigSettingsRequest {
  scheduleCron: string | null;
  rotateOnAccessEnd: boolean;

  constructor(init: { scheduleCron: string | null; rotateOnAccessEnd: boolean }) {
    this.scheduleCron = init.scheduleCron;
    this.rotateOnAccessEnd = init.rotateOnAccessEnd;
  }
}
