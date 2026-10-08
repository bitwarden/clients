import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Every gating surface on the open item guards on this, since the cipher view renders for every
 * vault item and would otherwise fire a PAM read for plain ones.
 */
export function isGovernedCipher(cipher: Pick<CipherView, "partial" | "leaseGated">): boolean {
  return cipher.partial || cipher.leaseGated === true;
}
