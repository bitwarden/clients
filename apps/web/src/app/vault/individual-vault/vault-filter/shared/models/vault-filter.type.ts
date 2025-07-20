import { CollectionAdminView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

export type CipherStatus = "all" | "favorites" | "trash" | CipherType;

export type CipherTypeFilter = ITreeNodeObject & { type: CipherStatus; icon: string };
export type CollectionFilter = CollectionAdminView & {
  icon: string;
};
export type FolderFilter = FolderView & {
  icon: string;
  /**
   * Full folder name.
   *
   * Used for when the folder `name` property is be separated into parts.
   */
  fullName?: string;
};
export type OrganizationFilter = Organization & { icon: string; hideOptions?: boolean };
