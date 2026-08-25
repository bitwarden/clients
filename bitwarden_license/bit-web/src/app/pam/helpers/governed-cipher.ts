import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Whether PAM governs this cipher: the server still has it gated (`partial`), or it was already
 * revealed under a lease (`leaseGated`, stamped client-side once the lease lands).
 *
 * One home for the rule, because every gating surface on the open item guards on it and they must
 * agree. The cipher view and the item-details card render for EVERY vault item in the product, so
 * without the guard opening any plain item would fire a PAM read.
 */
export function isGovernedCipher(cipher: Pick<CipherView, "partial" | "leaseGated">): boolean {
  return cipher.partial || cipher.leaseGated === true;
}
