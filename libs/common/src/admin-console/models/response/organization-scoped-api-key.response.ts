import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationScopedApiKeyResponse extends BaseResponse {
  id: string;
  clientId: string;
  name: string;
  scopes: string[];
  expireAt: string | null;
  creationDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.clientId = this.getResponseProperty("ClientId");
    this.name = this.getResponseProperty("Name");
    this.scopes = this.getResponseProperty("Scopes") ?? [];
    this.expireAt = this.getResponseProperty("ExpireAt") ?? null;
    this.creationDate = this.getResponseProperty("CreationDate");
  }
}
