import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { LeasingPolicy, parseLeasingPolicy } from "../leasing-policy";

export class LeasingPolicyResponse extends BaseResponse {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  policy: LeasingPolicy;
  creationDate: string;
  revisionDate: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Name");
    this.description = this.getResponseProperty("Description") ?? null;
    this.policy = parseLeasingPolicy(this.getResponseProperty("Policy"));
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
  }
}
