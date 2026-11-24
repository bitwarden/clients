// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  EncryptionType,
  EXPECTED_NUM_PARTS_BY_ENCRYPTION_TYPE,
} from "./enums/encryption-type.enum";

/** Stands in for a value whose decryption failed, so a view can render something. */
export const DECRYPT_ERROR = "[error: cannot decrypt]";

/**
 * Splits a serialized EncString into its type and its parts.
 *
 * Two shapes exist: a typed string "<type>.<part>|<part>", and a bare
 * "<part>|<part>" that predates the type prefix and is always AesCbc256_B64.
 */
function parseEncryptedString(encryptedString: string): {
  encType: EncryptionType;
  encPieces: string[];
} {
  const headerPieces = encryptedString.split(".");
  let encType: EncryptionType;
  let encPieces: string[] = null;

  if (headerPieces.length === 2) {
    try {
      encType = parseInt(headerPieces[0], null);
      encPieces = headerPieces[1].split("|");
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return { encType: NaN, encPieces: [] };
    }
  } else {
    encPieces = encryptedString.split("|");
    encType = EncryptionType.AesCbc256_B64;
  }

  return {
    encType,
    encPieces,
  };
}

/** True when `s` parses as an EncString carrying the part count its type requires. */
export function isSerializedEncString(s: string): boolean {
  if (s == null) {
    return false;
  }

  const { encType, encPieces } = parseEncryptedString(s);

  if (isNaN(encType) || encPieces.length === 0) {
    return false;
  }

  return EXPECTED_NUM_PARTS_BY_ENCRYPTION_TYPE[encType] === encPieces.length;
}
