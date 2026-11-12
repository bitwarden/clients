import { EMPTY, filter, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { CIPHER_LIST_VIEWS_CHANGED } from "../services/foreground-cipher.service";

/**
 * Tells an open popup each time the background's list views change, after an edit, sync or
 * `localData` update, so the popup fetches them again. The popup holds no decrypted vault of its
 * own and cannot see these changes otherwise.
 *
 *   background                              popup
 *   cipherListViewsIncludingRestricted$ ──▶ CIPHER_LIST_VIEWS_CHANGED
 *                                       ◀── GET_CIPHER_LIST_VIEWS
 */
export class ListViewsAnnouncerService {
  constructor(
    private readonly accountService: AccountService,
    private readonly cipherService: CipherService,
    private readonly messageSender: MessageSender,
  ) {}

  init(): void {
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) =>
          account == null
            ? EMPTY
            : this.cipherService.cipherListViewsIncludingRestricted$(account.id),
        ),
        // Null means cleared or still decrypting: nothing new to fetch yet.
        filter((views) => views != null),
      )
      .subscribe(() => this.messageSender.send(CIPHER_LIST_VIEWS_CHANGED));
  }
}
