import { BaseResponse } from "../../../../models/response/base.response";

export class KeyConnectorConfirmationDetailsResponse extends BaseResponse {
  organizationName: string;

  constructor(response: any) {
    super(response);
    this.organizationName = this.getResponseProperty("OrganizationName");
  }
}
