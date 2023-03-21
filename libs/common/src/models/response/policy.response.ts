import { PolicyType } from "../../enums/policyType";
import { Guid } from "../../types/guid";

import { BaseResponse } from "./base.response";

export class PolicyResponse extends BaseResponse {
  id: Guid;
  organizationId: Guid;
  type: PolicyType;
  data: any;
  enabled: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.organizationId = this.getResponseProperty<Guid>("OrganizationId");
    this.type = this.getResponseProperty("Type");
    this.data = this.getResponseProperty("Data");
    this.enabled = this.getResponseProperty("Enabled");
  }
}
