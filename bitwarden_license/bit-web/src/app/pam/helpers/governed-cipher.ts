import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Whether PAM governs this cipher: the server still has it gated (`partial`), or it was already
 * revealed under a lease (`leaseGated`).
 *
 * One home for the rule, since every gating surface on the open item guards on it; the cipher
 * view renders for every vault item, so without the guard opening any plain item would fire a
 * PAM read.
 */
export function isGovernedCipher(cipher: Pick<CipherView, "partial" | "leaseGated">): boolean {
  return cipher.partial || cipher.leaseGated === true;
}
