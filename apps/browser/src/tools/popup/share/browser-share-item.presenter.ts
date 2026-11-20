import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { ShareItemPresenter } from "@bitwarden/tools-share";

/**
 * Presents sharing on the extension's own page. The popup has no room for a drawer or a dialog
 * over the item, so it navigates instead — see the `share-item` route.
 *
 * The route loads the item itself, so this needs nothing but the id and deliberately does not
 * decrypt the item first.
 */
@Injectable()
export class BrowserShareItemPresenter implements ShareItemPresenter {
  private router = inject(Router);

  async present(cipher: CipherViewLike): Promise<void> {
    await this.router.navigate(["/share-item"], { queryParams: { cipherId: cipher.id } });
  }
}
