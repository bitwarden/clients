import { Observable } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/** Replaces a popup vault row's subtitle for the items the provider governs. */
export interface VaultRowSubtitle {
  /**
   * The already-translated subtitle for `cipher`, or `null` for the row's default subtitle. Live:
   * the row re-renders on each emission.
   */
  subtitle$(cipher: CipherViewLike): Observable<string | null>;
}

/** Optional subtitle provider for popup vault rows. Unprovided, rows show their default subtitle. */
export const VAULT_ROW_SUBTITLE = new SafeInjectionToken<VaultRowSubtitle>("VaultRowSubtitle");
