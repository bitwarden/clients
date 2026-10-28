import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";

/**
 * Desktop always decrypts full views on unlock (autofill, SSH agent, autotype), so list views
 * reuse that decrypt instead of running a second SDK list-view decrypt. See PM-45766.
 */
export class DesktopCipherService extends CipherService {
  override cipherListViewsWithPartials$ = (userId: UserId): Observable<CipherView[] | null> =>
    this.cipherViewsWithPartials$(userId);
}
