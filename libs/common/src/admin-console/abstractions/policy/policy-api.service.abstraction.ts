// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ListResponse } from "../../../models/response/list.response";
import { PolicyType } from "../../enums";
import { MasterPasswordPolicyOptions } from "../../models/domain/master-password-policy-options";
import { Policy } from "../../models/domain/policy";
import { PolicyRequest } from "../../models/request/policy.request";
import { PolicyResponse } from "../../models/response/policy.response";

export class PolicyApiServiceAbstraction {
  getPolicy: (organizationId: string, type: PolicyType) => Promise<PolicyResponse>;
  getPolicies: (organizationId: string) => Promise<ListResponse<PolicyResponse>>;

  getPoliciesByToken: (
    organizationId: string,
    token: string,
    email: string,
    organizationUserId: string,
  ) => Promise<Policy[] | undefined>;

  getMasterPasswordPolicyOptsForOrgUser: (
    orgId: string,
  ) => Promise<MasterPasswordPolicyOptions | null>;
  putPolicy: (organizationId: string, type: PolicyType, request: PolicyRequest) => Promise<any>;
}
