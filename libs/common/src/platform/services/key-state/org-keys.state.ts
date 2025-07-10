import { EncryptedOrganizationKeyData } from "../../../admin-console/models/data/encrypted-organization-key.data";
import { OrganizationId } from "../../../types/guid";
import { CRYPTO_DISK, UserKeyDefinition } from "../../state";

export const USER_ENCRYPTED_ORGANIZATION_KEYS = UserKeyDefinition.record<
  EncryptedOrganizationKeyData,
  OrganizationId
>(CRYPTO_DISK, "organizationKeys", {
  deserializer: (obj) => obj,
  clearOn: ["logout"],
});
