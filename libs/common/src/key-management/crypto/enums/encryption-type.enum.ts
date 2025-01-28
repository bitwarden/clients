export enum EncryptionType {
  AesCbc256_B64 = 0,
  AesCbc128_HmacSha256_B64 = 1,
  AesCbc256_HmacSha256_B64 = 2,
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
 * For example, an EncString of type AesCbc256_B64 will have 2 parts, and an EncString of type
 * AesCbc128_HmacSha256_B64 will have 3 parts.
 *
 * Example of annotated serialized EncStrings:
 * 0.iv|data
 * 1.iv|data|mac
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
  [EncryptionType.AesCbc128_HmacSha256_B64]: 3,
  [EncryptionType.AesCbc256_HmacSha256_B64]: 3,
  [EncryptionType.Rsa2048_OaepSha256_B64]: 1,
  [EncryptionType.Rsa2048_OaepSha1_B64]: 1,
  [EncryptionType.Rsa2048_OaepSha256_HmacSha256_B64]: 2,
  [EncryptionType.Rsa2048_OaepSha1_HmacSha256_B64]: 2,
};
