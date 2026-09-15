import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherListView } from "@bitwarden/sdk-internal";
import { VaultFilterService } from "@bitwarden/vault";

/**
 * Web individual-vault variant of {@link VaultFilterService} that includes PAM-gated ("partial")
 * ciphers when deciding which folders have items, matching the web vault list (which renders gated
 * rows). Other clients keep the base behavior, which excludes partials so a gated cipher never
 * surfaces a folder where it isn't shown.
 */
@Injectable()
export class WebIndividualVaultFilterService extends VaultFilterService {
  protected override folderFilterCiphers$(
    userId: UserId,
  ): Observable<CipherView[] | CipherListView[]> {
    return this.cipherService.cipherListViewsWithPartials$(userId);
  }
}
