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
};

export type VaultFilterList = {
  [key in VaultFilterLabel]?: VaultFilterSection;
};
