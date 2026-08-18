import { Observable } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * Row-menu actions for a PAM-gated ("partial") cipher in the vault list.
 *
 * This is the OSS-consumable seam: the implementation lives in commercial code
 * (`bitwarden_license/bit-web`). `vault-cipher-row` injects it `{ optional: true }`, so in builds
 * without the commercial app the abstraction is simply unprovided and the row menu offers nothing
 * extra for a gated cipher. The row passes its cipher through untouched and renders one menu item
 * off the answer — everything else (gating, state reads, the cancel round-trip and its outcome
 * toasts) belongs to the implementation, keeping the seam's footprint in the row minimal.
 */
export abstract class VaultRowAccessActionsService {
  /**
   * Whether the caller has an outstanding access request for the cipher that can still be
   * withdrawn — pending an approver, or approved but not yet started. Emits `false` for a cipher
   * that is not PAM-gated. Safe to call from a template: the returned stream is memoized per
   * cipher, and lazy — the state is read on subscription (the row menu subscribes on open) and
   * re-read when the cipher's access changes.
   */
  abstract cancelableRequest$(cipher: CipherViewLike): Observable<boolean>;

  /**
   * Withdraw the cipher's outstanding access request. Outcome (success or failure) is surfaced by
   * the implementation itself; the returned promise resolves either way.
   */
  abstract cancelRequest(cipher: CipherViewLike): Promise<void>;
}
