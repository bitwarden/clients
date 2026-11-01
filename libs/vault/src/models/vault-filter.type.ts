import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { BitwardenIcon } from "@bitwarden/components";

export type CipherStatus = "all" | "favorites" | "archive" | "trash" | CipherType;

export type CipherTypeFilter = ITreeNodeObject & { type: CipherStatus; icon?: BitwardenIcon };
/**
 * A node of the "Controlled access" group. Its ids and names come from the host that fills the
 * controlled-access seam; this library only routes the selected id back out.
 */
export type ControlledAccessFilter = ITreeNodeObject & { icon?: BitwardenIcon };

export type CollectionFilter = CollectionAdminView & {
  icon?: BitwardenIcon;
};
export type FolderFilter = FolderView & {
  icon?: BitwardenIcon;
  /**
   * Full folder name.
   *
   * Used for when the folder `name` property is be separated into parts.
   */
  fullName?: string;
};
export type OrganizationFilter = Organization & { icon?: BitwardenIcon; hideOptions?: boolean };
