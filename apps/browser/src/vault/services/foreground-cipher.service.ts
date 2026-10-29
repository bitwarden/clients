import { filter, map, startWith, Subject, switchMap } from "rxjs";

import { MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";
import { perUserCache$ } from "@bitwarden/common/vault/utils/observable-utilities";
import { CipherListView } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../platform/browser/browser-api";

export const GET_CIPHER_LIST_VIEWS = "getCipherListViews";

/** What the background's `CipherService` sends each time its list views change. */
const LIST_VIEWS_CHANGED = "updateOverlayCiphers";

/**
 * The popup's cipher service. Takes the list views from the background, which already
 * decrypted them, instead of decrypting the whole vault again on every popup open.
 */
export class ForegroundCipherService extends CipherService {
  private readonly clearListViews$ = new Subject<UserId | null>();

  constructor(
    private readonly messageListener: MessageListener,
    ...cipherServiceArgs: ConstructorParameters<typeof CipherService>
  ) {
    super(...cipherServiceArgs);
  }

  // Fetches when opened and whenever the background announces new list views, so the popup
  // never asks before the background caught up with a change.
  override cipherListViewsIncludingRestricted$ = perUserCache$(
    (userId: UserId) =>
      this.messageListener.allMessages$.pipe(
        filter((message) => message.command === LIST_VIEWS_CHANGED),
        startWith(null),
        switchMap(() =>
          BrowserApi.sendMessageWithResponse<{ result: CipherListView[] }>(GET_CIPHER_LIST_VIEWS, {
            userId,
          }),
        ),
        // No answer, e.g. from a background still starting after a restart, is not ready yet;
        // the background announces its list views once it has decrypted them.
        map((response) => response?.result ?? null),
      ),
    this.clearListViews$,
  );

  /** Drops the popup's copy of the list views too, e.g. on lock. */
  override async clearCache(userId?: UserId): Promise<void> {
    await super.clearCache(userId);
    this.clearListViews$.next(userId ?? null);
  }
}
