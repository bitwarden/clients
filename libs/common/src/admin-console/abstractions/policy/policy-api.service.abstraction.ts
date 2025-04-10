import { ListResponse } from "../../../models/response/list.response";
import { PolicyType } from "../../enums";
import { MasterPasswordPolicyOptions } from "../../models/domain/master-password-policy-options";
import { Policy } from "../../models/domain/policy";
import { PolicyRequest } from "../../models/request/policy.request";
import { PolicyResponse } from "../../models/response/policy.response";

export abstract class PolicyApiServiceAbstraction {
  abstract getPolicy: (organizationId: string, type: PolicyType) => Promise<PolicyResponse>;
  abstract getPolicies: (organizationId: string) => Promise<ListResponse<PolicyResponse>>;

  abstract getPoliciesByToken: (
    organizationId: string,
    token: string,
    email: string,
    organizationUserId: string,
  ) => Promise<Policy[] | undefined>;

  abstract getMasterPasswordPolicyOptsForOrgUser: (
    orgId: string,
  ) => Promise<MasterPasswordPolicyOptions | null>;
  abstract putPolicy: (
    organizationId: string,
    type: PolicyType,
    request: PolicyRequest,
  ) => Promise<any>;
}
