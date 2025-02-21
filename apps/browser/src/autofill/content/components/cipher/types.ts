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
  reprompt: CipherRepromptType;
  favorite: boolean;
  icon: WebsiteIconData;
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
};
