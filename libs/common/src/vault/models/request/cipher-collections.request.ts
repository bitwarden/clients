import { Guid } from "../../../types/guid";

export class CipherCollectionsRequest {
  collectionIds: Guid[];

  constructor(collectionIds: Guid[]) {
    this.collectionIds = collectionIds == null ? [] : collectionIds;
  }
}
