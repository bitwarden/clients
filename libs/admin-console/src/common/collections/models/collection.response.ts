import { SelectionReadOnlyResponse } from "@bitwarden/common/admin-console/models/response/selection-read-only.response";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

export class CollectionResponse extends BaseResponse {
  id: CollectionId;
  organizationId: OrganizationId;
  name: string;
  externalId: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Name");
    this.externalId = this.getResponseProperty("ExternalId");
  }
}

export class CollectionDetailsResponse extends CollectionResponse {
  readOnly: boolean;
  manage: boolean;
  hidePasswords: boolean;

  /**
   * Flag indicating the user has been explicitly assigned to this Collection
   */
  assigned: boolean;

  constructor(response: any) {
    super(response);
    this.readOnly = this.getResponseProperty("ReadOnly") || false;
    this.manage = this.getResponseProperty("Manage") || false;
    this.hidePasswords = this.getResponseProperty("HidePasswords") || false;

    // Temporary until the API is updated to return this property in AC-2084
    // For now, we can assume that if the object is 'collectionDetails' then the user is assigned
    this.assigned = this.getResponseProperty("object") == "collectionDetails";
  }
}

export class CollectionAccessDetailsResponse extends CollectionDetailsResponse {
  groups: SelectionReadOnlyResponse[] = [];
  users: SelectionReadOnlyResponse[] = [];
  unmanaged: boolean;

  constructor(response: any) {
    super(response);
    this.assigned = this.getResponseProperty("Assigned") || false;
    this.unmanaged = this.getResponseProperty("Unmanaged") || false;

    const groups = this.getResponseProperty("Groups");
    if (groups != null) {
      this.groups = groups.map((g: any) => new SelectionReadOnlyResponse(g));
    }

    const users = this.getResponseProperty("Users");
    if (users != null) {
      this.users = users.map((g: any) => new SelectionReadOnlyResponse(g));
    }
  }
}
