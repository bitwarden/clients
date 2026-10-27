import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";

export const ImportDestinationKind = Object.freeze({
  MyVault: "myVault",
  MyItems: "myItems",
  Organization: "organization",
} as const);
export type ImportDestinationKind =
  (typeof ImportDestinationKind)[keyof typeof ImportDestinationKind];

/** An org whose "Remove item type" policy drops these types from imports. */
export type ImportDestinationRestriction = {
  organizationName: string;
  types: readonly CipherType[];
};

export type ImportDestinationOption = {
  /** Unique within a list: "myVault", "myItems:<orgId>" or "organization:<orgId>". */
  id: string;
  kind: ImportDestinationKind;
  /** The org itself for an organization, the owning org for My items; unset for My vault. */
  organizationId?: OrganizationId;
  organizationName?: string;
  productTierType?: ProductTierType;
  /** The user's My items collection; set only for My items. */
  defaultCollection?: CollectionView;
  /** Shared folders in the org the user manages; empty for My vault and My items. */
  sharedFolders: readonly CollectionView[];
  /**
   * Orgs and types the callouts name. On My vault this leaves out orgs the user has accepted but is
   * not confirmed in, though their policies still apply, so count from `removedTypes`, not this.
   */
  restrictions: readonly ImportDestinationRestriction[];
  /** The types an import into this card drops, by the same rule the import filter uses. */
  removedTypes: readonly CipherType[];
};

export type ImportDestinations = {
  options: readonly ImportDestinationOption[];
  /** False when the user has nowhere to choose from, so location selection is skipped. */
  hasStep: boolean;
};
