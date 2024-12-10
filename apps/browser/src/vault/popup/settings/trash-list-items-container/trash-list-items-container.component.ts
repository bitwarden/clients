import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
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
import { CanDeleteCipherDirective, PasswordRepromptService } from "@bitwarden/vault";

@Component({
  selector: "app-trash-list-items-container",
  templateUrl: "trash-list-items-container.component.html",
  standalone: true,
  imports: [
    CommonModule,
    ItemModule,
    JslibModule,
    SectionComponent,
    SectionHeaderComponent,
    CanDeleteCipherDirective,
    MenuModule,
    IconButtonModule,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrashListItemsContainerComponent {
  /**
   * The list of trashed items to display.
   */
  @Input()
  ciphers: CipherView[] = [];

  @Input()
  headerText: string;

  constructor(
    private cipherService: CipherService,
    private logService: LogService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private passwordRepromptService: PasswordRepromptService,
    private router: Router,
  ) {}

  async restore(cipher: CipherView) {
    try {
      await this.cipherService.restoreWithServer(cipher.id);

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
      await this.cipherService.deleteWithServer(cipher.id);

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
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
    if (!repromptPassed) {
      return;
    }

    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: cipher.id, type: cipher.type },
    });
  }
}
