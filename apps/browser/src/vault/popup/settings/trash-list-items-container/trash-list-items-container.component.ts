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
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
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
  @Input()
  ciphers: PopupCipherViewLike[] = [];

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

  async restore(cipher: CipherView) {
    try {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.restoreWithServer(cipher.id, activeUserId);

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

  async delete(cipher: CipherView) {
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
      await this.cipherService.deleteWithServer(cipher.id, activeUserId);

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

  async onViewCipher(cipher: CipherView) {
    if (cipher.decryptionFailure) {
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
      queryParams: { cipherId: cipher.id, type: cipher.type },
    });
  }
}
