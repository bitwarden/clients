import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { LeasingPolicy, parseLeasingPolicy } from "../leasing-policy";

export class CollectionLeasingConfigResponse extends BaseResponse {
  collectionId: string;
  leasingEnabled: boolean;
  policy: LeasingPolicy | null;

  constructor(response: unknown) {
    super(response);
    this.collectionId = this.getResponseProperty("CollectionId");
    this.leasingEnabled = this.getResponseProperty("LeasingEnabled") ?? false;
    const policy = this.getResponseProperty("Policy");
    this.policy = policy == null ? null : parseLeasingPolicy(policy);
  }
}
