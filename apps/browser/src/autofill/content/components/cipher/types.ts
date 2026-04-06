import { CipherIconDetails } from "@bitwarden/common/vault/icon/build-cipher-icon";

export const CipherTypes = {
  Login: 1,
  SecureNote: 2,
  Card: 3,
  Identity: 4,
} as const;

type CipherType = (typeof CipherTypes)[keyof typeof CipherTypes];

export const CipherRepromptTypes = {
  None: 0,
  Password: 1,
} as const;

type CipherRepromptType = (typeof CipherRepromptTypes)[keyof typeof CipherRepromptTypes];

export type OrganizationCategory =
  (typeof OrganizationCategories)[keyof typeof OrganizationCategories];

export const OrganizationCategories = {
  business: "business",
  family: "family",
} as const;

type BaseCipherData<CipherTypeValue> = {
  id: string;
  name: string;
  type: CipherTypeValue;
  reprompt: CipherRepromptType;
  favorite: boolean;
  icon: CipherIconDetails;
};

export type CipherData = BaseCipherData<CipherType> & {
  accountCreationFieldType?: string;
  login?: {
    username: string;
    passkey: {
      rpName: string;
      userName: string;
    } | null;
  };
  card?: string;
  identity?: {
    fullName: string;
    username?: string;
  };
};

export type NotificationCipherData = BaseCipherData<typeof CipherTypes.Login> & {
  login?: {
    username: string;
  };
  organizationCategories?: OrganizationCategory[];
};
