import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { EncString as SdkEncString } from "@bitwarden/sdk-internal";

/**
 * Converts a string value to an EncString, handling null/undefined gracefully.
 *
 * @param value - The string value to convert, or undefined
 * @returns An EncString instance if value is defined, otherwise undefined
 *
 */
export const conditionalEncString = (value?: string): EncString | undefined => {
  return value != null ? new EncString(value) : undefined;
};

/**
 * Converts an EncString representation (from JSON or SDK) to a domain EncString instance.
 * Handles both serialized JSON representations and SDK EncString objects.
 *
 * @param value - The EncString representation (string, object, or SdkEncString), or undefined
 * @returns A domain EncString instance if value is defined, otherwise undefined
 *
 */
export const encStringFrom = <T extends string | SdkEncString>(
  value?: T,
): EncString | undefined => {
  return value != null ? EncString.fromJSON(value) : undefined;
};
