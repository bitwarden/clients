import { CollectionAdminView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FolderView } from "@bitwarden/common/src/vault/models/view/folder.view";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";

export type CipherStatus = "all" | "favorites" | "trash" | CipherType;

export type CipherTypeFilter = ITreeNodeObject & { type: CipherStatus; icon: string };
export type CollectionFilter = CollectionAdminView & {
  icon: string;
};
export type FolderFilter = FolderView & { icon: string };
export type OrganizationFilter = Organization & { icon: string; hideOptions?: boolean };
