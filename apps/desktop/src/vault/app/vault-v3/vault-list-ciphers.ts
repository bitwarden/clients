import { Observable, switchMap } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherListView } from "@bitwarden/sdk-internal";

/**
 * The ciphers the vault page lists. Restricted ciphers are included only under VFO1, whose table
 * gates them; the legacy list has no restricted gating.
 */
export function vaultListCiphers$(
  cipherService: CipherService,
  userId: UserId,
  vfo1Foundation$: Observable<boolean>,
): Observable<CipherListView[] | CipherView[]> {
  return vfo1Foundation$.pipe(
    switchMap((vfo1Foundation) =>
      vfo1Foundation
        ? cipherService.cipherListViewsIncludingRestricted$(userId)
        : cipherService.cipherListViews$(userId),
    ),
  );
}
