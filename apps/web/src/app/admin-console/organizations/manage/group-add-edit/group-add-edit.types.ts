import { FormControl, FormGroup } from "@angular/forms";

import { UserId } from "@bitwarden/common/types/guid";

import { AccessItemValue, AccessItemView } from "../../shared/components/access-selector";

/**
 * Indices for the available tabs in the group add/edit dialog
 */
export const GroupAddEditTabType = Object.freeze({
  Info: 0,
  Members: 1,
  Collections: 2,
} as const);
export type GroupAddEditTabType = (typeof GroupAddEditTabType)[keyof typeof GroupAddEditTabType];

export const GroupAddEditDialogResultType = Object.freeze({
  Saved: "saved",
  Canceled: "canceled",
  Deleted: "deleted",
} as const);
export type GroupAddEditDialogResultType =
  (typeof GroupAddEditDialogResultType)[keyof typeof GroupAddEditDialogResultType];

export interface GroupAddDialogParams {
  /** ID of the organization the group will belong to */
  organizationId: string;

  /** Tab to open when the dialog is open. Defaults to Group Info */
  initialTab?: GroupAddEditTabType;
}

export interface GroupEditDialogParams {
  /** ID of the organization the group belongs to */
  organizationId: string;

  /** ID of the group being modified */
  groupId: string;

  /** Tab to open when the dialog is open. Defaults to Group Info */
  initialTab?: GroupAddEditTabType;
}

/** Access-selector view augmented with the `userId` we need to detect the current user */
export type AccessMemberItemView = AccessItemView & { userId: UserId };

/** Typed shape of the group form used by both add and edit dialogs */
export type GroupFormGroup = FormGroup<{
  name: FormControl<string | null>;
  externalId: FormControl<string | null>;
  members: FormControl<AccessItemValue[] | null>;
  collections: FormControl<AccessItemValue[] | null>;
}>;
