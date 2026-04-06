import { CipherId, CollectionId, OrganizationId } from "../../../types/guid";

export class CipherBulkUpdateCollectionsRequest {
  organizationId: OrganizationId;
  cipherIds: CipherId[];
  collectionIds: CollectionId[];
  removeCollections: boolean;
  constructor(
    organizationId: OrganizationId,
    cipherIds: CipherId[],
    collectionIds: CollectionId[],
    removeCollections: boolean = false,
  ) {
    this.organizationId = organizationId;
    this.cipherIds = cipherIds;
    this.collectionIds = collectionIds;
    this.removeCollections = removeCollections;
  }
}
