import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

import { SmAccessPermission, SmAccessPolicy, toSmPermission } from "../access/sm-access-policies";

import { SmGranteeType } from "./sm-grantee.response";

export class SmAccessPolicyResponse implements BaseResponse {
  object = "sm-access-policy";

  type: SmGranteeType;
  id: string;
  name: string;
  permission: SmAccessPermission;

  constructor(policy: SmAccessPolicy) {
    this.type = policy.type;
    this.id = policy.id;
    this.name = policy.name ?? null;
    this.permission = toSmPermission(policy);
  }
}
