export type EncryptedOrganizationKeyData =
  | OrganizationEncryptedOrganizationKeyData
  | ProviderEncryptedOrganizationKeyData;

type OrganizationEncryptedOrganizationKeyData = {
  type: "organization";
  key: string;
};

type ProviderEncryptedOrganizationKeyData = {
  type: "provider";
  key: string;
  providerId: string;
};
