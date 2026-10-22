import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Every gating surface on the open item guards on this, since the cipher view renders for every
 * vault item and would otherwise fire a PAM read for plain ones.
 *
 * @param revealed True while `RevealedCipherService` holds the cipher's full view. That view is no
 * longer `partial`, but PAM still governs it.
 */
export function isGovernedCipher(cipher: Pick<CipherView, "partial">, revealed: boolean): boolean {
  return cipher.partial || revealed;
}
