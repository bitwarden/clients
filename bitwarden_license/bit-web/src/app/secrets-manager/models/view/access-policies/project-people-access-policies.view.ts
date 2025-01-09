// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { GroupAccessPolicyView, UserAccessPolicyView } from "./access-policy.view";

export class ProjectPeopleAccessPoliciesView {
  userAccessPolicies: UserAccessPolicyView[];
  groupAccessPolicies: GroupAccessPolicyView[];
}
