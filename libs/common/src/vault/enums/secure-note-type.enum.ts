import { SecureNoteType as SdkSecureNoteType } from "@bitwarden/sdk-internal";

import { UnionOfValues } from "../types/union-of-values";

export const SecureNoteType = {
  Generic: 0,
} as const;

export type SecureNoteType = UnionOfValues<typeof SecureNoteType>;

/**
 * Normalizes a SecureNoteType value to ensure compatibility with the SDK.
 * @param value - The secure note type from user data
 * @returns Valid SecureNoteType, defaults to SecureNoteType.Generic if unrecognized
 */
export function normalizeSecureNoteTypeForSdk(value: SecureNoteType): SdkSecureNoteType {
  return SecureNoteType.Generic;
}
