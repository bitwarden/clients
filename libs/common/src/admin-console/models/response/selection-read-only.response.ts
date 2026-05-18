import { BaseResponse } from "../../../models/response/base.response";

export class SelectionReadOnlyResponse extends BaseResponse {
  id: string;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;
  /**
   * Whether this principal must obtain an approved lease (Privileged Access Manager) before
   * decrypting ciphers in the collection. Server is the source of truth; clients should default
   * to `false` when the field is absent (older API versions).
   */
  requireLease: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.readOnly = this.getResponseProperty("ReadOnly");
    this.hidePasswords = this.getResponseProperty("HidePasswords");
    this.manage = this.getResponseProperty("Manage");
    this.requireLease = this.getResponseProperty("RequireLease") ?? false;
  }
}
