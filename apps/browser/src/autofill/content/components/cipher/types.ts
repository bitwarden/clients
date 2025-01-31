// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CipherTypes = {
  Login: 1,
} as const;

type NotificationCipherType = (typeof CipherTypes)[keyof typeof CipherTypes];

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

export type NotificationCipherData = {
  id: string;
  name: string;
  type: NotificationCipherType;
  reprompt: CipherRepromptType;
  favorite: boolean;
  icon: WebsiteIconData;
  login?: {
    username: string;
  };
};
