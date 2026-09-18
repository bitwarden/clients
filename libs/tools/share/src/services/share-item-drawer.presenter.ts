import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService, ToastService } from "@bitwarden/components";

import { ShareItemDrawerComponent } from "../components/share-item-drawer/share-item-drawer.component";
import { ShareItemPresenter } from "../tokens/share-item-presenter.token";

/**
 * Presents sharing in the side drawer. This is the web vault's surface; clients whose sharing
 * lives somewhere else provide their own {@link ShareItemPresenter}.
 */
@Injectable({ providedIn: "root" })
export class ShareItemDrawerPresenter implements ShareItemPresenter {
  private accountService = inject(AccountService);
  private cipherService = inject(CipherService);
  private dialogService = inject(DialogService);
  private i18nService = inject(I18nService);
  private toastService = inject(ToastService);

  async present(cipher: CipherViewLike): Promise<void> {
    const cipherView = await this.resolveCipherView(cipher);

    if (!cipherView) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("unknownCipher"),
      });
      return;
    }

    await this.dialogService.openDrawer(ShareItemDrawerComponent, { data: { cipher: cipherView } });
  }

  /**
   * The drawer needs a full {@link CipherView}. Lists that render `CipherListView` rows have to
   * look one up; callers that already hold a decrypted view — the Admin Console, whose items are
   * not necessarily in the acting user's own vault — pass it straight through, because looking it
   * up by id would come back empty for them.
   */
  private async resolveCipherView(cipher: CipherViewLike): Promise<CipherView | undefined> {
    if (!CipherViewLikeUtils.isCipherListView(cipher)) {
      return cipher;
    }

    if (cipher.id == null) {
      return undefined;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    // The SDK and `common` tag cipher ids separately, so the two do not overlap structurally.
    return await firstValueFrom(
      this.cipherService.cipherView$(userId, cipher.id as unknown as CipherId),
    );
  }
}
