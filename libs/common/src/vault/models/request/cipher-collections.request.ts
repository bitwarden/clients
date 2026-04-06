export class CipherCollectionsRequest {
  collectionIds: string[];

  constructor(collectionIds: string[]) {
    this.collectionIds = collectionIds == null ? [] : collectionIds;
  }
}
