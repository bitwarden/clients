import {
  CollectionResponse,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import { CollectionPermission } from "../access-selector/access-selector.models";

export const CollectionDialogTabType = Object.freeze({
  Info: 0,
  Access: 1,
} as const);
export type CollectionDialogTabType =
  (typeof CollectionDialogTabType)[keyof typeof CollectionDialogTabType];

export const CollectionDialogAction = Object.freeze({
  Saved: "saved",
  Canceled: "canceled",
  Deleted: "deleted",
  Upgrade: "upgrade",
} as const);
export type CollectionDialogAction =
  (typeof CollectionDialogAction)[keyof typeof CollectionDialogAction];

export interface CollectionDialogParams {
  collectionId?: CollectionId;
  organizationId: OrganizationId;
  initialTab?: CollectionDialogTabType;
  parentCollectionId?: string;
  showOrgSelector?: boolean;
  initialPermission?: CollectionPermission;
  /**
   * Flag to limit the nested collections to only those the user has explicit CanManage access too.
   */
  limitNestedCollections?: boolean;
  readonly?: boolean;
  isAddAccessCollection?: boolean;
  isAdminConsoleActive?: boolean;
}

export interface CollectionDialogResult {
  action: CollectionDialogAction;
  collection: CollectionResponse | CollectionView;
}
