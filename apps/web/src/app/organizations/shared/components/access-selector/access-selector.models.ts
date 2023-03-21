import { OrganizationUserStatusType } from "@bitwarden/common/enums/organizationUserStatusType";
import { OrganizationUserType } from "@bitwarden/common/enums/organizationUserType";
import { Guid } from "@bitwarden/common/types/guid";
import { SelectItemView } from "@bitwarden/components";

import { CollectionAccessSelectionView } from "../../../core";

/**
 * Permission options that replace/correspond with readOnly and hidePassword server fields.
 */
export enum CollectionPermission {
  View = "view",
  ViewExceptPass = "viewExceptPass",
  Edit = "edit",
  EditExceptPass = "editExceptPass",
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
export type AccessItemView =
  | SelectItemView & {
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
  if (value.readOnly) {
    return value.hidePasswords ? CollectionPermission.ViewExceptPass : CollectionPermission.View;
  } else {
    return value.hidePasswords ? CollectionPermission.EditExceptPass : CollectionPermission.Edit;
  }
};

/**
 * Converts an AccessItemValue back into a CollectionAccessView class using the CollectionPermission
 * to determine the values for `readOnly` and `hidePassword`
 * @param value
 */
export const convertToSelectionView = (value: AccessItemValue) => {
  return new CollectionAccessSelectionView({
    id: value.id as Guid,
    readOnly: readOnly(value.permission),
    hidePasswords: hidePassword(value.permission),
  });
};

const readOnly = (perm: CollectionPermission) =>
  [CollectionPermission.View, CollectionPermission.ViewExceptPass].includes(perm);

const hidePassword = (perm: CollectionPermission) =>
  [CollectionPermission.ViewExceptPass, CollectionPermission.EditExceptPass].includes(perm);
