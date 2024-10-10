export class OrganizationCollectionManagementUpdateRequest {
  limitCollectionCreation: boolean;
  limitCollectionDeletion: boolean;
  // Deprecated: https://bitwarden.atlassian.net/browse/PM-10863
  limitCreateDeleteOwnerAdmin: boolean;
  allowAdminAccessToAllCollectionItems: boolean;
}
