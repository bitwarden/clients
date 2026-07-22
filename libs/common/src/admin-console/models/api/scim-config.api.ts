import { BaseResponse } from "../../../models/response/base.response";
import { ScimProviderType } from "../../enums";

export class ScimConfigApi extends BaseResponse {
  enabled: boolean;
  scimProvider: ScimProviderType;
  inviteUsersAfterProvisioning: boolean | undefined;

  constructor(data: any) {
    super(data);
    this.enabled = this.getResponseProperty("Enabled");
    this.scimProvider = this.getResponseProperty("ScimProvider");
    this.inviteUsersAfterProvisioning = this.getResponseProperty("InviteUsersAfterProvisioning");
  }
}
