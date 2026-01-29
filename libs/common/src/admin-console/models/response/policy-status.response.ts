import { BaseResponse } from "../../../models/response/base.response";
import { PolicyType } from "../../enums";

export class PolicyStatusResponse extends BaseResponse {
  organizationId: string;
  type: PolicyType;
  data: any;
  enabled: boolean;
  canToggleState: boolean;

  constructor(response: any) {
    super(response);
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.type = this.getResponseProperty("Type");
    this.data = this.getResponseProperty("Data");
    this.enabled = this.getResponseProperty("Enabled");
    this.canToggleState = this.getResponseProperty("CanToggleState") ?? true;
  }
}
