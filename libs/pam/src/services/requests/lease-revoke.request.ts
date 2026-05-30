export class LeaseRevokeRequest {
  reason?: string;

  constructor(init: { reason?: string }) {
    this.reason = init.reason;
  }
}
