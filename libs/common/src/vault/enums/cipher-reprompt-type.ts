/**
 * @deprecated instead use `CipherRepromptTypes` constants and `CipherRepromptTypeValue` type over unsafe typescript enums
 **/
export enum CipherRepromptType {
  None = 0,
  Password = 1,
}

export const CipherRepromptTypes = {
  None: 0,
  Password: 1,
} as const;

export type CipherRepromptTypeValue =
  (typeof CipherRepromptTypes)[keyof typeof CipherRepromptTypes];
