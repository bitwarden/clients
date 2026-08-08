/**
 * Request body for extending an active lease (the lease is identified by the path, `POST /leases/{id}/extend`).
 * Extensions are always auto-approved (subject to the governing rule's AllowsExtensions / MaxExtensions settings):
 * the server pushes the lease's end out by `durationSeconds` from its current end, in place. A justifying `reason`
 * is required.
 */
export class AccessLeaseExtensionRequest {
  durationSeconds: number;
  reason: string;

  constructor(init: { durationSeconds: number; reason: string }) {
    this.durationSeconds = init.durationSeconds;
    this.reason = init.reason;
  }
}
