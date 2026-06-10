export class AccessLeaseExtensionRequest {
  leaseId: string;
  notBefore?: string;
  notAfter: string;
  reason?: string;

  constructor(init: { leaseId: string; notBefore?: Date; notAfter: Date; reason?: string }) {
    this.leaseId = init.leaseId;
    this.notBefore = init.notBefore?.toISOString();
    this.notAfter = init.notAfter.toISOString();
    this.reason = init.reason;
  }
}
