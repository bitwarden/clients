import { Guid } from "../../types/guid";

import { BaseResponse } from "./base.response";
import { SelectionReadOnlyResponse } from "./selection-read-only.response";

export class CollectionResponse extends BaseResponse {
  id: Guid;
  organizationId: Guid;
  name: string;
  externalId: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.organizationId = this.getResponseProperty<Guid>("OrganizationId");
    this.name = this.getResponseProperty("Name");
    this.externalId = this.getResponseProperty("ExternalId");
  }
}

export class CollectionDetailsResponse extends CollectionResponse {
  readOnly: boolean;

  constructor(response: any) {
    super(response);
    this.readOnly = this.getResponseProperty("ReadOnly") || false;
  }
}

export class CollectionAccessDetailsResponse extends CollectionResponse {
  groups: SelectionReadOnlyResponse[] = [];
  users: SelectionReadOnlyResponse[] = [];

  /**
   * Flag indicating the user has been explicitly assigned to this Collection
   */
  assigned: boolean;

  constructor(response: any) {
    super(response);
    this.assigned = this.getResponseProperty("Assigned") || false;

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
