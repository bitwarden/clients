import {
  GrantedProjectAccessPolicyView,
  GrantedProjectPolicyPermissionDetailsView,
  GroupAccessPolicyView,
  ProjectServiceAccountsAccessPoliciesView,
  SecretAccessPoliciesView,
  ServiceAccountAccessPolicyView,
  ServiceAccountGrantedPoliciesView,
  UserAccessPolicyView,
} from "@bitwarden/bit-sm";

import { ApItemEnum } from "./enums/ap-item.enum";
import { ApPermissionEnum, ApPermissionEnumUtil } from "./enums/ap-permission.enum";

export type ApItemValueType = {
  id: string;
  type: ApItemEnum;
  permission: ApPermissionEnum;
  currentUserInGroup?: boolean;
  currentUser?: boolean;
};

export function convertToPeopleAccessPoliciesView(selectedPolicyValues: ApItemValueType[]) {
  return {
    userAccessPolicies: convertToUserAccessPolicyViews(selectedPolicyValues),
    groupAccessPolicies: convertToGroupAccessPolicyViews(selectedPolicyValues),
  };
}

export function convertToServiceAccountGrantedPoliciesView(
  selectedPolicyValues: ApItemValueType[],
): ServiceAccountGrantedPoliciesView {
  const view = new ServiceAccountGrantedPoliciesView();

  view.grantedProjectPolicies = selectedPolicyValues
    .filter((x) => x.type == ApItemEnum.Project)
    .map((filtered) => {
      const detailView = new GrantedProjectPolicyPermissionDetailsView();
      const policyView = new GrantedProjectAccessPolicyView();
      policyView.grantedProjectId = filtered.id;
      policyView.read = ApPermissionEnumUtil.toRead(filtered.permission);
      policyView.write = ApPermissionEnumUtil.toWrite(filtered.permission);

      detailView.accessPolicy = policyView;
      return detailView;
    });

  return view;
}

export function convertToProjectServiceAccountsAccessPoliciesView(
  selectedPolicyValues: ApItemValueType[],
): ProjectServiceAccountsAccessPoliciesView {
  return {
    serviceAccountAccessPolicies: convertToServiceAccountAccessPolicyViews(selectedPolicyValues),
  };
}

export function convertToSecretAccessPoliciesView(
  selectedPolicyValues: ApItemValueType[],
): SecretAccessPoliciesView {
  return {
    userAccessPolicies: convertToUserAccessPolicyViews(selectedPolicyValues),
    groupAccessPolicies: convertToGroupAccessPolicyViews(selectedPolicyValues),
    serviceAccountAccessPolicies: convertToServiceAccountAccessPolicyViews(selectedPolicyValues),
  };
}

function convertToUserAccessPolicyViews(apItemValues: ApItemValueType[]): UserAccessPolicyView[] {
  return apItemValues
    .filter((x) => x.type == ApItemEnum.User)
    .map((filtered) => {
      const policyView = new UserAccessPolicyView();
      policyView.organizationUserId = filtered.id;
      policyView.read = ApPermissionEnumUtil.toRead(filtered.permission);
      policyView.write = ApPermissionEnumUtil.toWrite(filtered.permission);
      return policyView;
    });
}

function convertToGroupAccessPolicyViews(apItemValues: ApItemValueType[]): GroupAccessPolicyView[] {
  return apItemValues
    .filter((x) => x.type == ApItemEnum.Group)
    .map((filtered) => {
      const policyView = new GroupAccessPolicyView();
      policyView.groupId = filtered.id;
      policyView.read = ApPermissionEnumUtil.toRead(filtered.permission);
      policyView.write = ApPermissionEnumUtil.toWrite(filtered.permission);
      return policyView;
    });
}

function convertToServiceAccountAccessPolicyViews(
  apItemValues: ApItemValueType[],
): ServiceAccountAccessPolicyView[] {
  return apItemValues
    .filter((x) => x.type == ApItemEnum.ServiceAccount)
    .map((filtered) => {
      const policyView = new ServiceAccountAccessPolicyView();
      policyView.serviceAccountId = filtered.id;
      policyView.read = ApPermissionEnumUtil.toRead(filtered.permission);
      policyView.write = ApPermissionEnumUtil.toWrite(filtered.permission);
      return policyView;
    });
}
