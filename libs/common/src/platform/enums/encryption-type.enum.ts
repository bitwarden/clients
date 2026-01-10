// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum EncryptionType {
  // Symmetric encryption types
  AesCbc256_B64 = 0,
  // Type 1 was the unused and removed AesCbc128_HmacSha256_B64
  AesCbc256_HmacSha256_B64 = 2,
  // Cose is the encoding for the key used, but contained can be:
  // - XChaCha20Poly1305
  CoseEncrypt0 = 7,

  // Asymmetric encryption types. These never occur in the same places that the symmetric ones would
  // and can be split out into a separate enum.
  Rsa2048_OaepSha256_B64 = 3,
  Rsa2048_OaepSha1_B64 = 4,
  Rsa2048_OaepSha256_HmacSha256_B64 = 5,
  Rsa2048_OaepSha1_HmacSha256_B64 = 6,
}

export function encryptionTypeToString(encryptionType: EncryptionType): string {
  if (encryptionType in EncryptionType) {
    return EncryptionType[encryptionType];
  } else {
    return "Unknown encryption type " + encryptionType;
  }
}

/** The expected number of parts to a serialized EncString of the given encryption type.
 * For example, an EncString of type AesCbc256_B64 will have 2 parts
 *
 * Example of annotated serialized EncStrings:
 * 0.iv|data
 * 2.iv|data|mac
 * 3.data
 * 4.data
 *
 * @see EncString
 * @see EncryptionType
 * @see EncString.parseEncryptedString
 */
export const EXPECTED_NUM_PARTS_BY_ENCRYPTION_TYPE = {
  [EncryptionType.AesCbc256_B64]: 2,
  [EncryptionType.AesCbc256_HmacSha256_B64]: 3,
  [EncryptionType.Rsa2048_OaepSha256_B64]: 1,
  [EncryptionType.Rsa2048_OaepSha1_B64]: 1,
  [EncryptionType.Rsa2048_OaepSha256_HmacSha256_B64]: 2,
  [EncryptionType.Rsa2048_OaepSha1_HmacSha256_B64]: 2,
  [EncryptionType.CoseEncrypt0]: 1,
};
