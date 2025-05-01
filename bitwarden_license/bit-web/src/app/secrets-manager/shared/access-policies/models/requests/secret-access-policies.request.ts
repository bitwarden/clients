// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AccessPolicyRequest } from "./access-policy.request";

export class SecretAccessPoliciesRequest {
  userAccessPolicyRequests: AccessPolicyRequest[];
  groupAccessPolicyRequests: AccessPolicyRequest[];
  serviceAccountAccessPolicyRequests: AccessPolicyRequest[];
}
