import { BaseResponse } from "../../../models/response/base.response";
import { OrganizationApiKeyType } from "../../enums";

export class OrganizationApiKeyInformationResponse extends BaseResponse {
  keyType: OrganizationApiKeyType;

  constructor(response: any) {
    super(response);
    this.keyType = this.getResponseProperty("KeyType");
  }
}
