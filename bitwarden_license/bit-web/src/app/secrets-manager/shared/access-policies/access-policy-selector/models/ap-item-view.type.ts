// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SelectItemView } from "@bitwarden/components";

import {
  GroupAccessPolicyView,
  ServiceAccountAccessPolicyView,
  UserAccessPolicyView,
} from "../../../../models/view/access-policies/access-policy.view";
import { PotentialGranteeView } from "../../../../models/view/access-policies/potential-grantee.view";
import { ProjectPeopleAccessPoliciesView } from "../../../../models/view/access-policies/project-people-access-policies.view";
import { ProjectServiceAccountsAccessPoliciesView } from "../../../../models/view/access-policies/project-service-accounts-access-policies.view";
import { SecretAccessPoliciesView } from "../../../../models/view/access-policies/secret-access-policies.view";
import { ServiceAccountGrantedPoliciesView } from "../../../../models/view/access-policies/service-account-granted-policies.view";
import { ServiceAccountPeopleAccessPoliciesView } from "../../../../models/view/access-policies/service-account-people-access-policies.view";

import { ApItemEnum, ApItemEnumUtil } from "./enums/ap-item.enum";
import { ApPermissionEnum, ApPermissionEnumUtil } from "./enums/ap-permission.enum";

export type ApItemViewType = SelectItemView & {
  permission?: ApPermissionEnum;
  /**
   * Flag that this item cannot be modified.
   * This will disable the permission editor and will keep
   * the item always selected.
   */
  readOnly: boolean;
} & (
    | {
        type: ApItemEnum.User;
        currentUser?: boolean;
      }
    | {
        type: ApItemEnum.Group;
        currentUserInGroup?: boolean;
      }
    | {
        type: ApItemEnum.ServiceAccount;
      }
    | {
        type: ApItemEnum.Project;
      }
  );

export function convertToAccessPolicyItemViews(
  value: ProjectPeopleAccessPoliciesView | ServiceAccountPeopleAccessPoliciesView,
): ApItemViewType[] {
  return [
    ...toUserApItemViews(value.userAccessPolicies),
    ...toGroupApItemViews(value.groupAccessPolicies),
  ];
}

export function convertGrantedPoliciesToAccessPolicyItemViews(
  value: ServiceAccountGrantedPoliciesView,
): ApItemViewType[] {
  const accessPolicies: ApItemViewType[] = [];

  value.grantedProjectPolicies.forEach((detailView) => {
    accessPolicies.push({
      type: ApItemEnum.Project,
      icon: ApItemEnumUtil.itemIcon(ApItemEnum.Project),
      id: detailView.accessPolicy.grantedProjectId,
      labelName: detailView.accessPolicy.grantedProjectName,
      listName: detailView.accessPolicy.grantedProjectName,
      permission: ApPermissionEnumUtil.toApPermissionEnum(
        detailView.accessPolicy.read,
        detailView.accessPolicy.write,
      ),
      readOnly: !detailView.hasPermission,
    });
  });
  return accessPolicies;
}

export function convertProjectServiceAccountsViewToApItemViews(
  value: ProjectServiceAccountsAccessPoliciesView,
): ApItemViewType[] {
  return toServiceAccountsApItemViews(value.serviceAccountAccessPolicies);
}

export function convertSecretAccessPoliciesToApItemViews(
  value: SecretAccessPoliciesView,
): ApItemViewType[] {
  return [
    ...toUserApItemViews(value.userAccessPolicies),
    ...toGroupApItemViews(value.groupAccessPolicies),
    ...toServiceAccountsApItemViews(value.serviceAccountAccessPolicies),
  ];
}

export function convertPotentialGranteesToApItemViewType(
  grantees: PotentialGranteeView[],
): ApItemViewType[] {
  return grantees.map((granteeView) => {
    let icon: string;
    let type: ApItemEnum;
    let listName = granteeView.name;
    let labelName = granteeView.name;

    switch (granteeView.type) {
      case "user":
        icon = ApItemEnumUtil.itemIcon(ApItemEnum.User);
        type = ApItemEnum.User;
        if (Utils.isNullOrWhitespace(granteeView.name)) {
          listName = granteeView.email;
          labelName = granteeView.email;
        } else {
          listName = `${granteeView.name} (${granteeView.email})`;
        }
        break;
      case "group":
        icon = ApItemEnumUtil.itemIcon(ApItemEnum.Group);
        type = ApItemEnum.Group;
        break;
      case "serviceAccount":
        icon = ApItemEnumUtil.itemIcon(ApItemEnum.ServiceAccount);
        type = ApItemEnum.ServiceAccount;
        break;
      case "project":
        icon = ApItemEnumUtil.itemIcon(ApItemEnum.Project);
        type = ApItemEnum.Project;
        break;
    }

    return {
      icon: icon,
      type: type,
      id: granteeView.id,
      labelName: labelName,
      listName: listName,
      currentUserInGroup: granteeView.currentUserInGroup,
      currentUser: granteeView.currentUser,
      readOnly: false,
    };
  });
}

function toUserApItemViews(policies: UserAccessPolicyView[]): ApItemViewType[] {
  return policies.map((policy) => {
    return {
      type: ApItemEnum.User,
      icon: ApItemEnumUtil.itemIcon(ApItemEnum.User),
      id: policy.organizationUserId,
      labelName: policy.organizationUserName,
      listName: policy.organizationUserName,
      permission: ApPermissionEnumUtil.toApPermissionEnum(policy.read, policy.write),
      currentUser: policy.currentUser,
      readOnly: false,
    };
  });
}

function toGroupApItemViews(policies: GroupAccessPolicyView[]): ApItemViewType[] {
  return policies.map((policy) => {
    return {
      type: ApItemEnum.Group,
      icon: ApItemEnumUtil.itemIcon(ApItemEnum.Group),
      id: policy.groupId,
      labelName: policy.groupName,
      listName: policy.groupName,
      permission: ApPermissionEnumUtil.toApPermissionEnum(policy.read, policy.write),
      currentUserInGroup: policy.currentUserInGroup,
      readOnly: false,
    };
  });
}

function toServiceAccountsApItemViews(
  policies: ServiceAccountAccessPolicyView[],
): ApItemViewType[] {
  return policies.map((policy) => {
    return {
      type: ApItemEnum.ServiceAccount,
      icon: ApItemEnumUtil.itemIcon(ApItemEnum.ServiceAccount),
      id: policy.serviceAccountId,
      labelName: policy.serviceAccountName,
      listName: policy.serviceAccountName,
      permission: ApPermissionEnumUtil.toApPermissionEnum(policy.read, policy.write),
      readOnly: false,
    };
  });
}
