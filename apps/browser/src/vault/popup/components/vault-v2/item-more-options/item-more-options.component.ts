import { CommonModule } from "@angular/common";
import { booleanAttribute, Component, Input } from "@angular/core";
import { Router, RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  DialogService,
  IconButtonModule,
  ItemModule,
  MenuModule,
  ToastService,
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/popup/browser-popup-utils";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { AddEditQueryParams } from "../add-edit/add-edit-v2.component";

@Component({
  standalone: true,
  selector: "app-item-more-options",
  templateUrl: "./item-more-options.component.html",
  imports: [ItemModule, IconButtonModule, MenuModule, CommonModule, JslibModule, RouterModule],
})
export class ItemMoreOptionsComponent {
  @Input({
    required: true,
  })
  cipher: CipherView;

  /**
   * Flag to hide the autofill menu options. Used for items that are
   * already in the autofill list suggestion.
   */
  @Input({ transform: booleanAttribute })
  hideAutofillOptions: boolean;

  protected autofillAllowed$ = this.vaultPopupAutofillService.autofillAllowed$;

  constructor(
    private cipherService: CipherService,
    private passwordRepromptService: PasswordRepromptService,
    private toastService: ToastService,
    private dialogService: DialogService,
    private router: Router,
    private i18nService: I18nService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
  ) {}

  get canEdit() {
    return this.cipher.edit;
  }

  /**
   * Determines if the cipher can be autofilled.
   */
  get canAutofill() {
    return [CipherType.Login, CipherType.Card, CipherType.Identity].includes(this.cipher.type);
  }

  get isLogin() {
    return this.cipher.type === CipherType.Login;
  }

  get favoriteText() {
    return this.cipher.favorite ? "unfavorite" : "favorite";
  }

  async doAutofill() {
    await this.vaultPopupAutofillService.doAutofill(this.cipher);
  }

  async doAutofillAndSave() {
    await this.vaultPopupAutofillService.doAutofillAndSave(this.cipher);
  }

  /**
   * Determines if the login cipher can be launched in a new browser tab.
   */
  get canLaunch() {
    return this.cipher.type === CipherType.Login && this.cipher.login.canLaunch;
  }

  /**
   * Launches the login cipher in a new browser tab.
   */
  async launchCipher() {
    if (!this.canLaunch) {
      return;
    }

    await this.cipherService.updateLastLaunchedDate(this.cipher.id);

    await BrowserApi.createNewTab(this.cipher.login.launchUri);

    if (BrowserPopupUtils.inPopup(window)) {
      BrowserApi.closePopup(window);
    }
  }

  /**
   * Toggles the favorite status of the cipher and updates it on the server.
   */
  async toggleFavorite() {
    this.cipher.favorite = !this.cipher.favorite;
    const encryptedCipher = await this.cipherService.encrypt(this.cipher);
    await this.cipherService.updateWithServer(encryptedCipher);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(
        this.cipher.favorite ? "itemAddedToFavorites" : "itemRemovedFromFavorites",
      ),
    });
  }

  /**
   * Navigate to the clone cipher page with the current cipher as the source.
   * A password reprompt is attempted if the cipher requires it.
   * A confirmation dialog is shown if the cipher has FIDO2 credentials.
   */
  async clone() {
    if (
      this.cipher.reprompt === CipherRepromptType.Password &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      return;
    }

    if (this.cipher.login?.hasFido2Credentials) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "passkeyNotCopied" },
        content: { key: "passkeyNotCopiedAlert" },
        type: "info",
      });

      if (!confirmed) {
        return;
      }
    }

    await this.router.navigate(["/clone-cipher"], {
      queryParams: {
        clone: true.toString(),
        cipherId: this.cipher.id,
        type: this.cipher.type.toString(),
      } as AddEditQueryParams,
    });
  }
}
