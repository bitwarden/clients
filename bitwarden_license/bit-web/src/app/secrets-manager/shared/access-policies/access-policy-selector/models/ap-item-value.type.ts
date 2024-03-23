import {
  ProjectPeopleAccessPoliciesView,
  UserProjectAccessPolicyView,
  GroupProjectAccessPolicyView,
  ProjectServiceAccountsAccessPoliciesView,
  ServiceAccountProjectAccessPolicyView,
  ServiceAccountPeopleAccessPoliciesView,
  UserServiceAccountAccessPolicyView,
  GroupServiceAccountAccessPolicyView,
} from "../../../../models/view/access-policy.view";

import { ApItemEnum } from "./enums/ap-item.enum";
import { ApPermissionEnum, ApPermissionEnumUtil } from "./enums/ap-permission.enum";

export type ApItemValueType = {
  id: string;
  type: ApItemEnum;
  permission: ApPermissionEnum;
  currentUserInGroup?: boolean;
  currentUser?: boolean;
};

export function convertToProjectPeopleAccessPoliciesView(
  projectId: string,
  selectedPolicyValues: ApItemValueType[],
): ProjectPeopleAccessPoliciesView {
  const view = new ProjectPeopleAccessPoliciesView();
  view.userAccessPolicies = selectedPolicyValues
    .filter((x) => x.type == ApItemEnum.User)
    .map((filtered) => {
      const policyView = new UserProjectAccessPolicyView();
      policyView.grantedProjectId = projectId;
      policyView.organizationUserId = filtered.id;
      policyView.read = ApPermissionEnumUtil.toRead(filtered.permission);
      policyView.write = ApPermissionEnumUtil.toWrite(filtered.permission);
      return policyView;
    });

  view.groupAccessPolicies = selectedPolicyValues
    .filter((x) => x.type == ApItemEnum.Group)
    .map((filtered) => {
      const policyView = new GroupProjectAccessPolicyView();
      policyView.grantedProjectId = projectId;
      policyView.groupId = filtered.id;
      policyView.read = ApPermissionEnumUtil.toRead(filtered.permission);
      policyView.write = ApPermissionEnumUtil.toWrite(filtered.permission);
      return policyView;
    });
  return view;
}

export function convertToProjectServiceAccountsAccessPoliciesView(
  projectId: string,
  selectedPolicyValues: ApItemValueType[],
): ProjectServiceAccountsAccessPoliciesView {
  const view = new ProjectServiceAccountsAccessPoliciesView();

  view.serviceAccountAccessPolicies = selectedPolicyValues
    .filter((selection) => selection.type == ApItemEnum.ServiceAccount)
    .map((filtered) => {
      const policyView = new ServiceAccountProjectAccessPolicyView();
      policyView.grantedProjectId = projectId;
      policyView.serviceAccountId = filtered.id;
      policyView.read = ApPermissionEnumUtil.toRead(filtered.permission);
      policyView.write = ApPermissionEnumUtil.toWrite(filtered.permission);
      return policyView;
    });

  return view;
}

export function convertToServiceAccountPeopleAccessPoliciesView(
  serviceAccountId: string,
  selectedPolicyValues: ApItemValueType[],
): ServiceAccountPeopleAccessPoliciesView {
  const view = new ServiceAccountPeopleAccessPoliciesView();
  view.userAccessPolicies = selectedPolicyValues
    .filter((x) => x.type == ApItemEnum.User)
    .map((filtered) => {
      const policyView = new UserServiceAccountAccessPolicyView();
      policyView.grantedServiceAccountId = serviceAccountId;
      policyView.organizationUserId = filtered.id;
      policyView.read = ApPermissionEnumUtil.toRead(filtered.permission);
      policyView.write = ApPermissionEnumUtil.toWrite(filtered.permission);
      policyView.currentUser = filtered.currentUser;
      return policyView;
    });

  view.groupAccessPolicies = selectedPolicyValues
    .filter((x) => x.type == ApItemEnum.Group)
    .map((filtered) => {
      const policyView = new GroupServiceAccountAccessPolicyView();
      policyView.grantedServiceAccountId = serviceAccountId;
      policyView.groupId = filtered.id;
      policyView.read = ApPermissionEnumUtil.toRead(filtered.permission);
      policyView.write = ApPermissionEnumUtil.toWrite(filtered.permission);
      return policyView;
    });
  return view;
}
