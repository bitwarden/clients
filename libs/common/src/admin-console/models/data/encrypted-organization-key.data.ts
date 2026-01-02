import { UnsignedSharedKey } from "@bitwarden/sdk-internal";

export type EncryptedOrganizationKeyData =
  | OrganizationEncryptedOrganizationKeyData
  | ProviderEncryptedOrganizationKeyData;

type OrganizationEncryptedOrganizationKeyData = {
  type: "organization";
  key: UnsignedSharedKey;
};

type ProviderEncryptedOrganizationKeyData = {
  type: "provider";
  key: string;
  providerId: string;
};
