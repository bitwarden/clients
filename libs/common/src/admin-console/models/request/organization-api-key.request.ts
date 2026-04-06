import { SecretVerificationRequest } from "../../../auth/models/request/secret-verification.request";
import { OrganizationApiKeyType } from "../../enums";

export class OrganizationApiKeyRequest extends SecretVerificationRequest {
  type: OrganizationApiKeyType = OrganizationApiKeyType.Default;
}
