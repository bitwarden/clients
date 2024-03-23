import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SelectItemView } from "@bitwarden/components";

import {
  ProjectPeopleAccessPoliciesView,
  ServiceAccountPeopleAccessPoliciesView,
  ProjectServiceAccountsAccessPoliciesView,
} from "../../../../models/view/access-policy.view";
import { PotentialGranteeView } from "../../../../models/view/potential-grantee.view";

import { ApItemEnum, ApItemEnumUtil } from "./enums/ap-item.enum";
import { ApPermissionEnum, ApPermissionEnumUtil } from "./enums/ap-permission.enum";

export type ApItemViewType = SelectItemView & {
  accessPolicyId?: string;
  permission?: ApPermissionEnum;
} & (
    | {
        type: ApItemEnum.User;
        userId?: string;
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

export function convertPeoplePoliciesToApItemViewType(
  value: ProjectPeopleAccessPoliciesView | ServiceAccountPeopleAccessPoliciesView,
): ApItemViewType[] {
  const accessPolicies: ApItemViewType[] = [];

  value.userAccessPolicies.forEach((policy) => {
    accessPolicies.push({
      type: ApItemEnum.User,
      icon: ApItemEnumUtil.itemIcon(ApItemEnum.User),
      id: policy.organizationUserId,
      accessPolicyId: policy.id,
      labelName: policy.organizationUserName,
      listName: policy.organizationUserName,
      permission: ApPermissionEnumUtil.toApPermissionEnum(policy.read, policy.write),
      userId: policy.userId,
      currentUser: policy.currentUser,
    });
  });

  value.groupAccessPolicies.forEach((policy) => {
    accessPolicies.push({
      type: ApItemEnum.Group,
      icon: ApItemEnumUtil.itemIcon(ApItemEnum.Group),
      id: policy.groupId,
      accessPolicyId: policy.id,
      labelName: policy.groupName,
      listName: policy.groupName,
      permission: ApPermissionEnumUtil.toApPermissionEnum(policy.read, policy.write),
      currentUserInGroup: policy.currentUserInGroup,
    });
  });

  return accessPolicies;
}

export function convertPoliciesToApItemViewType(
  value: ProjectServiceAccountsAccessPoliciesView,
): ApItemViewType[] {
  const accessPolicies: ApItemViewType[] = [];

  value.serviceAccountAccessPolicies.forEach((policy) => {
    accessPolicies.push({
      type: ApItemEnum.ServiceAccount,
      icon: ApItemEnumUtil.itemIcon(ApItemEnum.User),
      id: policy.serviceAccountId,
      accessPolicyId: policy.id,
      labelName: policy.serviceAccountName,
      listName: policy.serviceAccountName,
      permission: ApPermissionEnumUtil.toApPermissionEnum(policy.read, policy.write),
    });
  });

  return accessPolicies;
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
    };
  });
}
