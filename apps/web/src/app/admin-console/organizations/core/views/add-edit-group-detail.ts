import { CollectionAccessSelectionView } from "@bitwarden/admin-console/common";

export interface AddEditGroupDetail {
  id: string;
  organizationId: string;
  name: string;
  externalId: string;
  collections: CollectionAccessSelectionView[];
  members: string[];
}
