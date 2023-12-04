import { OrganizationUserUserDetailsResponse } from "@bitwarden/common/admin-console/abstractions/organization-user/responses";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { SelectItemView } from "@bitwarden/components";

import { CollectionAccessSelectionView, GroupView } from "../../../core";

/**
 * Permission options that replace/correspond with manage, readOnly, and hidePassword server fields.
 */
export enum CollectionPermission {
  View = "view",
  ViewExceptPass = "viewExceptPass",
  Edit = "edit",
  EditExceptPass = "editExceptPass",
  Manage = "manage",
}

export enum AccessItemType {
  Collection,
  Group,
  Member,
}

/**
 * A "generic" type that describes an item that can be selected from a
 * ng-select list and have its collection permission modified.
 *
 * Currently, it supports Collections, Groups, and Members. Members require some additional
 * details to render in the AccessSelectorComponent so their type is defined separately
 * and then joined back with the base type.
 *
 */
export type AccessItemView = SelectItemView & {
  /**
   * Flag that this group/member can access all items.
   * This will disable the permission editor for this item.
   */
  accessAllItems?: boolean;

  /**
   * Flag that this item cannot be modified.
   * This will disable the permission editor and will keep
   * the item always selected.
   */
  readonly?: boolean;

  /**
   * Optional permission that will be rendered for this
   * item if it set to readonly.
   */
  readonlyPermission?: CollectionPermission;
} & (
    | {
        type: AccessItemType.Collection;
        viaGroupName?: string;
      }
    | {
        type: AccessItemType.Group;
      }
    | {
        type: AccessItemType.Member; // Members have a few extra details required to display, so they're added here
        email: string;
        role: OrganizationUserType;
        status: OrganizationUserStatusType;
      }
  );

/**
 * A type that is emitted as a value for the ngControl
 */
export type AccessItemValue = {
  id: string;
  permission?: CollectionPermission;
  type: AccessItemType;
};

/**
 * Converts the CollectionAccessSelectionView interface to one of the new CollectionPermission values
 * for the dropdown in the AccessSelectorComponent
 * @param value
 */
export const convertToPermission = (value: CollectionAccessSelectionView) => {
  if (value.manage) {
    return CollectionPermission.Manage;
  } else if (value.readOnly) {
    return value.hidePasswords ? CollectionPermission.ViewExceptPass : CollectionPermission.View;
  } else {
    return value.hidePasswords ? CollectionPermission.EditExceptPass : CollectionPermission.Edit;
  }
};

/**
 * Converts an AccessItemValue back into a CollectionAccessView class using the CollectionPermission
 * to determine the values for `manage`, `readOnly`, and `hidePassword`
 * @param value
 */
export const convertToSelectionView = (value: AccessItemValue) => {
  return new CollectionAccessSelectionView({
    id: value.id,
    readOnly: readOnly(value.permission),
    hidePasswords: hidePassword(value.permission),
    manage: value.permission === CollectionPermission.Manage,
  });
};

const readOnly = (perm: CollectionPermission) =>
  [CollectionPermission.View, CollectionPermission.ViewExceptPass].includes(perm);

const hidePassword = (perm: CollectionPermission) =>
  [CollectionPermission.ViewExceptPass, CollectionPermission.EditExceptPass].includes(perm);

export function mapGroupToAccessItemView(group: GroupView): AccessItemView {
  return {
    id: group.id,
    type: AccessItemType.Group,
    listName: group.name,
    labelName: group.name,
    accessAllItems: group.accessAll,
    readonly: group.accessAll,
  };
}

// TODO: Use view when user apis are migrated to a service
export function mapUserToAccessItemView(user: OrganizationUserUserDetailsResponse): AccessItemView {
  return {
    id: user.id,
    type: AccessItemType.Member,
    email: user.email,
    role: user.type,
    listName: user.name?.length > 0 ? `${user.name} (${user.email})` : user.email,
    labelName: user.name ?? user.email,
    status: user.status,
    accessAllItems: user.accessAll,
    readonly: user.accessAll,
  };
}
