import { Observable } from "rxjs";

import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";

import {
  CipherTypeFilter,
  CollectionFilter,
  FolderFilter,
  OrganizationFilter,
} from "./vault-filter.type";

export type VaultFilterType =
  | OrganizationFilter
  | CipherTypeFilter
  | FolderFilter
  | CollectionFilter;

export const VaultFilterLabel = {
  OrganizationFilter: "organizationFilter",
  TypeFilter: "typeFilter",
  FolderFilter: "folderFilter",
  CollectionFilter: "collectionFilter",
  ArchiveFilter: "archiveFilter",
  TrashFilter: "trashFilter",
} as const;

type VaultFilterLabel = UnionOfValues<typeof VaultFilterLabel>;

export type VaultFilterSection = {
  data$: Observable<TreeNode<VaultFilterType>>;
  header: {
    showHeader: boolean;
    isSelectable: boolean;
  };
  action: (filterNode: TreeNode<VaultFilterType>) => Promise<void>;
  edit?: {
    filterName: string;
    action: (filter: VaultFilterType) => void;
  };
  add?: {
    text: string;
    route?: string;
    action?: () => void;
  };
  options?: {
    component: any;
  };
  divider?: boolean;
  premiumOptions?: {
    /**  When true, the premium badge will show on the filter for non-premium users. */
    showBadgeForNonPremium?: true;
    /**
     * Action to be called instead of applying the filter.
     * Useful when the user does not have access to a filter (e.g., premium feature)
     * and custom behavior is needed when invoking the filter.
     */
    blockFilterAction?: () => Promise<void>;
  };
};

export type VaultFilterList = {
  [key in VaultFilterLabel]?: VaultFilterSection;
};
