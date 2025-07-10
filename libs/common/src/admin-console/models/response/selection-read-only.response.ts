import { BaseResponse } from "../../../models/response/base.response";

export class SelectionReadOnlyResponse extends BaseResponse {
  id: string;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.readOnly = this.getResponseProperty("ReadOnly");
    this.hidePasswords = this.getResponseProperty("HidePasswords");
    this.manage = this.getResponseProperty("Manage");
  }
}
