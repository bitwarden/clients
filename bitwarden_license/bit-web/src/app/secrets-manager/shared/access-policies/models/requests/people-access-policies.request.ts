import { AccessPolicyRequest } from "./access-policy.request";

export class PeopleAccessPoliciesRequest {
  userAccessPolicyRequests?: AccessPolicyRequest[];
  groupAccessPolicyRequests?: AccessPolicyRequest[];
}
