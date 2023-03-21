import { Guid } from "../../types/guid";

import { BaseResponse } from "./base.response";

export class SelectionReadOnlyResponse extends BaseResponse {
  id: Guid;
  readOnly: boolean;
  hidePasswords: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.readOnly = this.getResponseProperty("ReadOnly");
    this.hidePasswords = this.getResponseProperty("HidePasswords");
  }
}
