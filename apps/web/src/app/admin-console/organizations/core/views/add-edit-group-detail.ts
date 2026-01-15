import { CollectionAccessSelectionView } from "@bitwarden/common/admin-console/models/collections";

export interface AddEditGroupDetail {
  id: string;
  organizationId: string;
  name: string;
  externalId: string;
  collections: CollectionAccessSelectionView[];
  members: string[];
}
