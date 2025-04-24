/**
 * @deprecated instead use `CipherTypes` constants and `CipherTypeValue` type over unsafe typescript enums
 **/
export enum CipherType {
  Login = 1,
  SecureNote = 2,
  Card = 3,
  Identity = 4,
  SshKey = 5,
}

export const CipherTypes = {
  Login: 1,
  SecureNote: 2,
  Card: 3,
  Identity: 4,
  SshKey: 5,
} as const;

export type CipherTypeValue = (typeof CipherTypes)[keyof typeof CipherTypes];
