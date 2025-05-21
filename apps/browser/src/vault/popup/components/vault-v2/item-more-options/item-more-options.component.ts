// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { booleanAttribute, Component, Input, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { BehaviorSubject, firstValueFrom, map, switchMap } from "rxjs";
import { filter } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import {
  DialogService,
  IconButtonModule,
  ItemModule,
  MenuModule,
  ToastService,
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { AddEditQueryParams } from "../add-edit/add-edit-v2.component";

@Component({
  standalone: true,
  selector: "app-item-more-options",
  templateUrl: "./item-more-options.component.html",
  imports: [ItemModule, IconButtonModule, MenuModule, CommonModule, JslibModule, RouterModule],
})
export class ItemMoreOptionsComponent implements OnInit {
  private _cipher$ = new BehaviorSubject<CipherView>(undefined);

  @Input({
    required: true,
  })
  set cipher(c: CipherView) {
    this._cipher$.next(c);
  }

  get cipher() {
    return this._cipher$.value;
  }

  /**
   * Flag to show view item menu option. Used when something else is
   * assigned as the primary action for the item, such as autofill.
   */
  @Input({ transform: booleanAttribute })
  showViewOption: boolean;

  /**
   * Flag to hide the autofill menu options. Used for items that are
   * already in the autofill list suggestion.
   */
  @Input({ transform: booleanAttribute })
  hideAutofillOptions: boolean;

  protected autofillAllowed$ = this.vaultPopupAutofillService.autofillAllowed$;

  /**
   * Observable that emits a boolean value indicating if the user is authorized to clone the cipher.
   * @protected
   */
  protected canClone$ = this._cipher$.pipe(
    filter((c) => c != null),
    switchMap((c) => this.cipherAuthorizationService.canCloneCipher$(c)),
  );

  /** Boolean dependent on the current user having access to an organization */
  protected hasOrganizations = false;

  constructor(
    private cipherService: CipherService,
    private passwordRepromptService: PasswordRepromptService,
    private toastService: ToastService,
    private dialogService: DialogService,
    private router: Router,
    private i18nService: I18nService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private cipherAuthorizationService: CipherAuthorizationService,
  ) {}

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.hasOrganizations = await firstValueFrom(this.organizationService.hasOrganizations(userId));
  }

  get canEdit() {
    return this.cipher.edit;
  }

  get canViewPassword() {
    return this.cipher.viewPassword;
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
    await this.vaultPopupAutofillService.doAutofillAndSave(this.cipher, false);
  }

  async onView() {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(this.cipher);
    if (!repromptPassed) {
      return;
    }
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: this.cipher.id, type: this.cipher.type },
    });
  }

  /**
   * Toggles the favorite status of the cipher and updates it on the server.
   */
  async toggleFavorite() {
    this.cipher.favorite = !this.cipher.favorite;
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    const encryptedCipher = await this.cipherService.encrypt(this.cipher, activeUserId);
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

  /** Prompts for password when necessary then navigates to the assign collections route */
  async conditionallyNavigateToAssignCollections() {
    if (this.cipher.reprompt && !(await this.passwordRepromptService.showPasswordPrompt())) {
      return;
    }

    await this.router.navigate(["/assign-collections"], {
      queryParams: { cipherId: this.cipher.id },
    });
  }
}
