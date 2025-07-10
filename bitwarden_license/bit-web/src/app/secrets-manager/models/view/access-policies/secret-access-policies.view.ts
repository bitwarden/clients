// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  GroupAccessPolicyView,
  UserAccessPolicyView,
  ServiceAccountAccessPolicyView,
} from "./access-policy.view";

export class SecretAccessPoliciesView {
  userAccessPolicies: UserAccessPolicyView[];
  groupAccessPolicies: GroupAccessPolicyView[];
  serviceAccountAccessPolicies: ServiceAccountAccessPolicyView[];
}
