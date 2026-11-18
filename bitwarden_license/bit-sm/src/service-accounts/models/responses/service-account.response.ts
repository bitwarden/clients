import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class ServiceAccountResponse extends BaseResponse {
  id: string;
  organizationId: string;
  name: string;
  creationDate: string;
  revisionDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Name");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
  }
}

export class ServiceAccountSecretsDetailsResponse extends ServiceAccountResponse {
  accessToSecrets: number;

  constructor(response: any) {
    super(response);
    this.accessToSecrets = this.getResponseProperty("AccessToSecrets");
  }
}
