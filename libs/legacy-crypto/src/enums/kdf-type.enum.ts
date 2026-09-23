// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum KdfType {
  PBKDF2_SHA256 = 0,
  Argon2id = 1,
}
