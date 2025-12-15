// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  DialogService,
  IconButtonModule,
  ItemModule,
  MenuModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  CanDeleteCipherDirective,
  DecryptionFailureDialogComponent,
  OrgIconDirective,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { PopupCipherViewLike } from "../../views/popup-cipher.view";

@Component({
  selector: "app-trash-list-items-container",
  templateUrl: "trash-list-items-container.component.html",
  imports: [
    CommonModule,
    ItemModule,
    JslibModule,
    SectionComponent,
    SectionHeaderComponent,
    CanDeleteCipherDirective,
    MenuModule,
    IconButtonModule,
    OrgIconDirective,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrashListItemsContainerComponent {
  /**
   * The list of trashed items to display.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  ciphers: PopupCipherViewLike[] = [];

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  headerText: string;

  constructor(
    private cipherService: CipherService,
    private logService: LogService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private passwordRepromptService: PasswordRepromptService,
    private accountService: AccountService,
    private router: Router,
  ) {}

  /**
   * The tooltip text for the organization icon for ciphers that belong to an organization.
   */
  orgIconTooltip({ collections, collectionIds }: PopupCipherViewLike) {
    if (collectionIds.length > 1) {
      return this.i18nService.t("nCollections", collectionIds.length);
    }

    return collections[0]?.name;
  }

  /**
   * Check if a cipher has attachments. CipherView has a hasAttachments getter,
   * while CipherListView has an attachments count property.
   */
  hasAttachments(cipher: PopupCipherViewLike): boolean {
    if ("hasAttachments" in cipher) {
      return cipher.hasAttachments;
    }
    return cipher.attachments > 0;
  }

  /**
   * Get the subtitle for a cipher. CipherView has a subTitle getter,
   * while CipherListView has a subtitle property.
   */
  getSubtitle(cipher: PopupCipherViewLike): string | undefined {
    if ("subTitle" in cipher) {
      return cipher.subTitle;
    }
    return cipher.subtitle;
  }

  /**
   * Check if a cipher has a decryption failure. CipherView has this property,
   * while CipherListView does not.
   */
  hasDecryptionFailure(cipher: PopupCipherViewLike): boolean {
    return "decryptionFailure" in cipher && cipher.decryptionFailure;
  }

  async restore(cipher: PopupCipherViewLike) {
    try {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.restoreWithServer(cipher.id as string, activeUserId);

      await this.router.navigate(["/trash"]);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("restoredItem"),
      });
    } catch (e) {
      this.logService.error(e);
    }
  }

  async delete(cipher: PopupCipherViewLike) {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);

    if (!repromptPassed) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: { key: "permanentlyDeleteItemConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.deleteWithServer(cipher.id as string, activeUserId);

      await this.router.navigate(["/trash"]);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("permanentlyDeletedItem"),
      });
    } catch (e) {
      this.logService.error(e);
    }
  }

  async onViewCipher(cipher: PopupCipherViewLike) {
    // CipherListView doesn't have decryptionFailure, so we use optional chaining
    if ("decryptionFailure" in cipher && cipher.decryptionFailure) {
      DecryptionFailureDialogComponent.open(this.dialogService, {
        cipherIds: [cipher.id as CipherId],
      });
      return;
    }

    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
    if (!repromptPassed) {
      return;
    }

    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: cipher.id as string, type: cipher.type },
    });
  }
}
