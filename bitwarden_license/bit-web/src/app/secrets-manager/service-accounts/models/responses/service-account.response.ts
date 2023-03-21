import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Guid } from "@bitwarden/common/types/guid";

export class ServiceAccountResponse extends BaseResponse {
  id: Guid;
  organizationId: Guid;
  name: string;
  creationDate: string;
  revisionDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.organizationId = this.getResponseProperty<Guid>("OrganizationId");
    this.name = this.getResponseProperty("Name");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
  }
}
