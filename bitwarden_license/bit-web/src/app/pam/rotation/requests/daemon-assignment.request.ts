/**
 * Body for `POST /organizations/{orgId}/rotation/daemons/{daemonId}/assignments`.
 * Assigns a target system to a daemon so it can rotate credentials on that target.
 */
export class DaemonAssignmentRequest {
  targetSystemId: string;

  constructor(init: { targetSystemId: string }) {
    this.targetSystemId = init.targetSystemId;
  }
}
