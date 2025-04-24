import {
  CipherTypes,
  CipherTypeValue,
  CipherRepromptTypeValue,
} from "@bitwarden/common/vault/enums";

export type OrganizationCategory =
  (typeof OrganizationCategories)[keyof typeof OrganizationCategories];

export const OrganizationCategories = {
  business: "business",
  family: "family",
} as const;

export type WebsiteIconData = {
  imageEnabled: boolean;
  image: string;
  fallbackImage: string;
  icon: string;
};

type BaseCipherData<CipherTypeValue> = {
  id: string;
  name: string;
  type: CipherTypeValue;
  reprompt: CipherRepromptTypeValue;
  favorite: boolean;
  icon: WebsiteIconData;
};

export type CipherData = BaseCipherData<CipherTypeValue> & {
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
