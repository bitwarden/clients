/**
 * Request to extend an active lease. Extensions are always auto-approved (subject to the governing rule's
 * AllowsExtensions / MaxExtensions settings): the server pushes the lease's end out by `durationSeconds` from its
 * current end, in place. A justifying `reason` is required.
 */
export class AccessLeaseExtensionRequest {
  leaseId: string;
  durationSeconds: number;
  reason: string;

  constructor(init: { leaseId: string; durationSeconds: number; reason: string }) {
    this.leaseId = init.leaseId;
    this.durationSeconds = init.durationSeconds;
    this.reason = init.reason;
  }
}
