import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Formats the ownership of a vault item for logging.
 */
export function ownership(cipher: Cipher): string {
  return cipher.organizationId == null ? "personal" : `organization ${cipher.organizationId}`;
}
