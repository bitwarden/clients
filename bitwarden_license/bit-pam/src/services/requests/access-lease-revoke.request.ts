export class AccessLeaseRevokeRequest {
  reason?: string;

  constructor(init: { reason?: string }) {
    this.reason = init.reason;
  }
}
