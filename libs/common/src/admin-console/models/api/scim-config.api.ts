// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";
import { ScimProviderType } from "../../enums";

export class ScimConfigApi extends BaseResponse {
  enabled: boolean;
  scimProvider: ScimProviderType;

  constructor(data: any) {
    super(data);
    if (data == null) {
      return;
    }
    this.enabled = this.getResponseProperty("Enabled");
    this.scimProvider = this.getResponseProperty("ScimProvider");
  }
}
