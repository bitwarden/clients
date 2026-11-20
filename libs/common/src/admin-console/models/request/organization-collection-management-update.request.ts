export class OrganizationCollectionManagementUpdateRequest {
  limitCollectionCreation: boolean;
  limitCollectionDeletion: boolean;
  limitItemDeletion: boolean;
  allowAdminAccessToAllCollectionItems: boolean;

  constructor(c: {
    limitCollectionCreation: boolean;
    limitCollectionDeletion: boolean;
    limitItemDeletion: boolean;
    allowAdminAccessToAllCollectionItems: boolean;
  }) {
    this.limitCollectionCreation = c.limitCollectionCreation;
    this.limitCollectionDeletion = c.limitCollectionDeletion;
    this.limitItemDeletion = c.limitItemDeletion;
    this.allowAdminAccessToAllCollectionItems = c.allowAdminAccessToAllCollectionItems;
  }
}
