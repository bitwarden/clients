// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { GrantedProjectAccessPolicyView } from "./access-policy.view";

export class ServiceAccountGrantedPoliciesView {
  grantedProjectPolicies: GrantedProjectPolicyPermissionDetailsView[];
}

export class GrantedProjectPolicyPermissionDetailsView {
  accessPolicy: GrantedProjectAccessPolicyView;
  hasPermission: boolean;
}
