import { BaseResponse } from "../../../models/response/base.response";
import { PolicyId } from "../../../types/guid";
import { PolicyType } from "../../enums";

export class PolicyResponse extends BaseResponse {
  id: PolicyId;
  organizationId: string;
  type: PolicyType;
  data: any;
  enabled: boolean;
  canToggleState: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.type = this.getResponseProperty("Type");
    this.data = this.getResponseProperty("Data");
    this.enabled = this.getResponseProperty("Enabled");
    this.canToggleState = this.getResponseProperty("CanToggleState") ?? true;
  }
}
