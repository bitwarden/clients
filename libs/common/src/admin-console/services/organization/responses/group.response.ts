import { SelectionReadOnlyResponse } from "@bitwarden/common/admin-console/models/response/selection-read-only.response";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class GroupResponse extends BaseResponse {
  id: string;
  organizationId: string;
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

export class GroupDetailsResponse extends GroupResponse {
  collections: SelectionReadOnlyResponse[] = [];

  constructor(response: any) {
    super(response);
    const collections = this.getResponseProperty("Collections");
    if (collections != null) {
      this.collections = collections.map((c: any) => new SelectionReadOnlyResponse(c));
    }
  }
}
