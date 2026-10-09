import { SecretVerificationRequest } from "../../../auth/models/request/secret-verification.request";

export class OrganizationScopedApiKeyCreateRequest extends SecretVerificationRequest {
  name = "";
  scopes: string[] = [];
  expireAt?: string;
}
