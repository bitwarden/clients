import { Guid } from "../../types/guid";

import { BaseResponse } from "./base.response";

export class OrganizationAutoEnrollStatusResponse extends BaseResponse {
  id: Guid;
  resetPasswordEnabled: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.resetPasswordEnabled = this.getResponseProperty("ResetPasswordEnabled");
  }
}
