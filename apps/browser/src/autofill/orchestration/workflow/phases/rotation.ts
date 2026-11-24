import type { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

/**
 * Advances a rotation so the next fill under its key offers the next cipher. A rotation cycles through
 * the ciphers a fill may offer; despite the service method's name, it does not record that a cipher
 * was used.
 */
export function cycle(cipherService: CipherService, key: string): void {
  cipherService.updateLastUsedIndexForUrl(key);
}
