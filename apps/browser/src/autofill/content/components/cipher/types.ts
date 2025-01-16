// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CipherTypes = {
  Login: 1,
  SecureNote: 2,
  Card: 3,
  Identity: 4,
} as const;

type CipherType = (typeof CipherTypes)[keyof typeof CipherTypes];

// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CipherRepromptTypes = {
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

export type CipherData = {
  id: string;
  name: string;
  type: CipherType;
  reprompt: CipherRepromptType;
  favorite: boolean;
  icon: WebsiteIconData;
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
