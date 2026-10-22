import { Observable } from "rxjs";

import { CipherId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { BitwardenIcon } from "@bitwarden/components";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/** One option of a contributed filter chip. */
export type VaultItemFilterOption = {
  readonly id: string;
  /** Already translated. */
  readonly name: string;
  readonly icon: BitwardenIcon;
};

/** One contributed filter chip in the vault items table. */
export type VaultItemFilter = {
  /**
   * Selection key. Unique among contributed filters. Stored as `vault.<key>` in the URL.
   * Must not be a built-in key (`VAULT_RESERVED_FILTER_KEYS`); the table throws in dev mode on a
   * clash.
   */
  readonly key: string;
  /** Already-translated chip label. */
  readonly label: string;
  /** The chip's options. An empty array hides the chip. */
  readonly options$: Observable<readonly VaultItemFilterOption[]>;
  /**
   * One live call for the whole list: option ID → IDs of the ciphers it admits.
   * The table keeps the subscription and filters again on each emission.
   * Emit only when membership changes (threshold, expiry, approval, request change), not on each
   * tick. Options may overlap. A row passes when it is in any selected option.
   */
  matches$(
    ciphers: readonly CipherViewLike[],
  ): Observable<ReadonlyMap<string, ReadonlySet<CipherId>>>;
};

/**
 * Optional filter chip in the vault items table, after the built-in chips. Multi-select: a row
 * passes when any selected option admits it, and the chip combines with the other chips by AND.
 * Unprovided, the table has no contributed chip.
 *
 * Host rules:
 *
 * 1. The table calls {@link VaultItemFilter.matches$} only once a selection for the key exists,
 *    from the user or restored from the URL. A vault that never uses the chip makes no call.
 * 2. The table keeps the subscription and filters again on each emission. It keeps the previous
 *    map until the next one lands.
 * 3. Rows can leave the list while the user looks at it. The selection is kept by cipher ID, and
 *    rows are tracked by ID, so the other rows keep their DOM nodes.
 * 4. A selected ID that `options$` does not offer (an old link) passes every row.
 * 5. Until the first map lands, and after an error from `matches$`, every row passes.
 *
 * Single token: widen it to `multi` when a second feature contributes a filter.
 */
export const VAULT_ITEM_FILTER = new SafeInjectionToken<VaultItemFilter>("VaultItemFilter");
