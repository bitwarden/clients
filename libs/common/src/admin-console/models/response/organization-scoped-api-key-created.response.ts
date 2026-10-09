import { OrganizationScopedApiKeyResponse } from "./organization-scoped-api-key.response";

export class OrganizationScopedApiKeyCreatedResponse extends OrganizationScopedApiKeyResponse {
  clientSecret: string;

  constructor(response: any) {
    super(response);
    this.clientSecret = this.getResponseProperty("ClientSecret");
  }
}
