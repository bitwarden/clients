export const TwoFactorMethod = Object.freeze({
  Totp: 1,
  Sms: 2,
  Duo: 3,
  Rsa: 4,
  Backup: 5,
  U2f: 6,
  WebAuthn: 7,
  KeeperPush: 8,
  KeeperDna: 9,
} as const);
export type TwoFactorMethod = (typeof TwoFactorMethod)[keyof typeof TwoFactorMethod];
