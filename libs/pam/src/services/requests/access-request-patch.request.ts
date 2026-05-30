export class AccessRequestPatchRequest {
  notBefore?: string;
  notAfter?: string;
  reason?: string;

  constructor(init: { notBefore?: Date; notAfter?: Date; reason?: string }) {
    this.notBefore = init.notBefore?.toISOString();
    this.notAfter = init.notAfter?.toISOString();
    this.reason = init.reason;
  }
}
