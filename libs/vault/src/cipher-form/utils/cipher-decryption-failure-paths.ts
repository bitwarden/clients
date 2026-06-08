import { CipherDecryptionFailure } from "@bitwarden/common/vault/models/cipher-decryption-failure";

/**
 * Canonical dotted-camelCase paths the SDK emits in
 * {@link CipherDecryptionFailure.path}. Match the SDK's wire format exactly.
 *
 * Indexed fields (URIs, custom fields, attachments, password history,
 * FIDO2 credentials) are not enumerated here — use {@link hasFailureAtIndexedPath}
 * for those.
 */
export const FIELD_PATHS = Object.freeze({
  NAME: "name",
  NOTES: "notes",

  LOGIN_USERNAME: "login.username",
  LOGIN_PASSWORD: "login.password",
  LOGIN_TOTP: "login.totp",

  CARD_CARDHOLDER_NAME: "card.cardholderName",
  CARD_NUMBER: "card.number",
  CARD_BRAND: "card.brand",
  CARD_EXP_MONTH: "card.expMonth",
  CARD_EXP_YEAR: "card.expYear",
  CARD_CODE: "card.code",

  IDENTITY_TITLE: "identity.title",
  IDENTITY_FIRST_NAME: "identity.firstName",
  IDENTITY_MIDDLE_NAME: "identity.middleName",
  IDENTITY_LAST_NAME: "identity.lastName",
  IDENTITY_USERNAME: "identity.username",
  IDENTITY_COMPANY: "identity.company",
  IDENTITY_SSN: "identity.ssn",
  IDENTITY_PASSPORT_NUMBER: "identity.passportNumber",
  IDENTITY_LICENSE_NUMBER: "identity.licenseNumber",
  IDENTITY_EMAIL: "identity.email",
  IDENTITY_PHONE: "identity.phone",
  IDENTITY_ADDRESS1: "identity.address1",
  IDENTITY_ADDRESS2: "identity.address2",
  IDENTITY_ADDRESS3: "identity.address3",
  IDENTITY_CITY: "identity.city",
  IDENTITY_STATE: "identity.state",
  IDENTITY_POSTAL_CODE: "identity.postalCode",
  IDENTITY_COUNTRY: "identity.country",

  SSH_PRIVATE_KEY: "sshKey.privateKey",
  SSH_PUBLIC_KEY: "sshKey.publicKey",
  SSH_FINGERPRINT: "sshKey.keyFingerprint",
} as const);

export type FieldPath = (typeof FIELD_PATHS)[keyof typeof FIELD_PATHS];

/**
 * Returns true when the supplied failures list contains an entry with an
 * exactly-matching `path`. Safe to call with `undefined` (returns false).
 */
export function hasFailureAtPath(
  failures: CipherDecryptionFailure[] | undefined,
  path: string,
): boolean {
  if (!failures || failures.length === 0) {
    return false;
  }
  return failures.some((f) => f.path === path);
}

/**
 * Returns true when the supplied failures list contains an entry whose path
 * matches the bracketed-index pattern `${prefix}[${index}].${suffix}`.
 *
 * @example
 *   hasFailureAtIndexedPath(failures, "login.uris", 0, "uri")
 *     // matches "login.uris[0].uri"
 */
export function hasFailureAtIndexedPath(
  failures: CipherDecryptionFailure[] | undefined,
  prefix: string,
  index: number,
  suffix: string,
): boolean {
  if (!failures || failures.length === 0) {
    return false;
  }
  const target = `${prefix}[${index}].${suffix}`;
  return failures.some((f) => f.path === target);
}

/**
 * Returns the SDK's display message for the first failure at the given path,
 * or `undefined` if no such failure exists. Display only — do not branch on it.
 */
export function getFailureMessageAtPath(
  failures: CipherDecryptionFailure[] | undefined,
  path: string,
): string | undefined {
  return failures?.find((f) => f.path === path)?.errorMessage;
}
