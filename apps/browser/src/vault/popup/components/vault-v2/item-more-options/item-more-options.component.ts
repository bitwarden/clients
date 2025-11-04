import { CommonModule } from "@angular/common";
import { booleanAttribute, Component, Input } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { BehaviorSubject, combineLatest, firstValueFrom, map, switchMap } from "rxjs";
import { filter } from "rxjs/operators";

import { CollectionService } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  DialogService,
  IconButtonModule,
  ItemModule,
  MenuModule,
  ToastService,
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
import { AddEditQueryParams } from "../add-edit/add-edit-v2.component";
import {
  AutofillConfirmationDialogComponent,
  AutofillConfirmationDialogResult,
} from "../autofill-confirmation-dialog/autofill-confirmation-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-item-more-options",
  templateUrl: "./item-more-options.component.html",
  imports: [ItemModule, IconButtonModule, MenuModule, CommonModule, JslibModule, RouterModule],
})
export class ItemMoreOptionsComponent {
  private _cipher$ = new BehaviorSubject<CipherViewLike>({} as CipherViewLike);

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({
    required: true,
  })
  set cipher(c: CipherViewLike) {
    this._cipher$.next(c);
  }

  get cipher() {
    return this._cipher$.value;
  }

  /**
   * Flag to show view item menu option. Used when something else is
   * assigned as the primary action for the item, such as autofill.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: booleanAttribute })
  showViewOption = false;

  /**
   * Flag to hide the autofill menu options. Used for items that are
   * already in the autofill list suggestion.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: booleanAttribute })
  hideAutofillOptions = false;

  protected autofillAllowed$ = this.vaultPopupAutofillService.autofillAllowed$;

  protected showAutofillConfirmation$ = combineLatest([
    this.configService.getFeatureFlag$(FeatureFlag.AutofillConfirmation),
    this.vaultPopupItemsService.hasSearchText$,
  ]).pipe(map(([isFeatureFlagEnabled, hasSearchText]) => isFeatureFlagEnabled && hasSearchText));

  protected uriMatchStrategy$ = this.domainSettingsService.resolvedDefaultUriMatchStrategy$;

  /**
   * Observable that emits a boolean value indicating if the user is authorized to clone the cipher.
   * @protected
   */
  protected canClone$ = combineLatest([
    this._cipher$,
    this.restrictedItemTypesService.restricted$,
  ]).pipe(
    filter(([c]) => c != null),
    switchMap(([c, restrictedTypes]) => {
      // This will check for restrictions from org policies before allowing cloning.
      const isItemRestricted = restrictedTypes.some(
        (restrictType) => restrictType.cipherType === CipherViewLikeUtils.getType(c),
      );
      if (!isItemRestricted) {
        return this.cipherAuthorizationService.canCloneCipher$(c);
      }
      return new BehaviorSubject(false);
    }),
  );

  /** Observable Boolean dependent on the current user having access to an organization and editable collections */
  protected canAssignCollections$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => {
      return combineLatest([
        this.organizationService.hasOrganizations(userId),
        this.collectionService.decryptedCollections$(userId),
      ]).pipe(
        map(([hasOrgs, collections]) => {
          const canEditCollections = collections.some((c) => !c.readOnly);
          return hasOrgs && canEditCollections;
        }),
      );
    }),
  );

  /** Observable Boolean checking if item can show Archive menu option */
  protected canArchive$ = combineLatest([
    this._cipher$,
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.cipherArchiveService.userCanArchive$(userId)),
    ),
  ]).pipe(
    filter(([cipher, userId]) => cipher != null && userId != null),
    map(([cipher, canArchive]) => {
      return canArchive && !CipherViewLikeUtils.isArchived(cipher) && cipher.organizationId == null;
    }),
  );

  protected canDelete$ = this._cipher$.pipe(
    switchMap((cipher) => this.cipherAuthorizationService.canDeleteCipher$(cipher)),
  );

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
    private collectionService: CollectionService,
    private restrictedItemTypesService: RestrictedItemTypesService,
    private cipherArchiveService: CipherArchiveService,
    private configService: ConfigService,
    private vaultPopupItemsService: VaultPopupItemsService,
    private domainSettingsService: DomainSettingsService,
  ) {}

  get canEdit() {
    return this.cipher.edit;
  }

  get canViewPassword() {
    return this.cipher.viewPassword;
  }

  get decryptionFailure() {
    return CipherViewLikeUtils.decryptionFailure(this.cipher);
  }

  /**
   * Determines if the cipher can be autofilled.
   */
  get canAutofill() {
    return ([CipherType.Login, CipherType.Card, CipherType.Identity] as CipherType[]).includes(
      CipherViewLikeUtils.getType(this.cipher),
    );
  }

  get isLogin() {
    return CipherViewLikeUtils.getType(this.cipher) === CipherType.Login;
  }

  get favoriteText() {
    return this.cipher.favorite ? "unfavorite" : "favorite";
  }

  async doAutofillAndSave() {
    const cipher = await this.cipherService.getFullCipherView(this.cipher);
    await this.vaultPopupAutofillService.doAutofillAndSave(cipher);
  }

  async doAutofill() {
    const cipher = await this.cipherService.getFullCipherView(this.cipher);

    const uris = cipher.login?.uris ?? [];
    const cipherHasAllExactMatchLoginUris =
      uris.length > 0 && uris.every((u) => u.uri && u.match === UriMatchStrategy.Exact);

    const showAutofillConfirmation = await firstValueFrom(this.showAutofillConfirmation$);
    const uriMatchStrategy = await firstValueFrom(this.uriMatchStrategy$);

    if (
      showAutofillConfirmation &&
      (cipherHasAllExactMatchLoginUris || uriMatchStrategy === UriMatchStrategy.Exact)
    ) {
      await this.dialogService.openSimpleDialog({
        title: { key: "cannotAutofill" },
        content: { key: "cannotAutofillExactMatch" },
        type: "info",
        acceptButtonText: { key: "okay" },
        cancelButtonText: null,
      });
      return;
    }

    if (!(await this.passwordRepromptService.passwordRepromptCheck(this.cipher))) {
      return;
    }

    if (!showAutofillConfirmation) {
      await this.vaultPopupAutofillService.doAutofill(cipher, true, true);
      return;
    }

    const currentTab = await firstValueFrom(this.vaultPopupAutofillService.currentAutofillTab$);

    if (!currentTab?.url) {
      await this.dialogService.openSimpleDialog({
        title: { key: "error" },
        content: { key: "errorGettingAutoFillData" },
        type: "danger",
      });
      return;
    }

    const ref = AutofillConfirmationDialogComponent.open(this.dialogService, {
      data: {
        currentUrl: currentTab?.url || "",
        savedUrls: cipher.login?.uris?.filter((u) => u.uri).map((u) => u.uri!) ?? [],
        viewOnly: !this.cipher.edit,
      },
    });

    const result = await firstValueFrom(ref.closed);

    switch (result) {
      case AutofillConfirmationDialogResult.Canceled:
        return;
      case AutofillConfirmationDialogResult.AutofilledOnly:
        await this.vaultPopupAutofillService.doAutofill(cipher, true, true);
        return;
      case AutofillConfirmationDialogResult.AutofillAndUrlAdded:
        await this.vaultPopupAutofillService.doAutofillAndSave(cipher, false, true);
        return;
    }
  }

  async onView() {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(this.cipher);
    if (!repromptPassed) {
      return;
    }
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: this.cipher.id, type: CipherViewLikeUtils.getType(this.cipher) },
    });
  }

  /**
   * Toggles the favorite status of the cipher and updates it on the server.
   */
  async toggleFavorite() {
    const cipher = await this.cipherService.getFullCipherView(this.cipher);

    cipher.favorite = !cipher.favorite;
    const activeUserId = (await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    )) as UserId;

    const encryptedCipher = await this.cipherService.encrypt(cipher, activeUserId);
    await this.cipherService.updateWithServer(encryptedCipher);
    this.toastService.showToast({
      variant: "success",
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

    if (CipherViewLikeUtils.hasFido2Credentials(this.cipher)) {
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
        type: CipherViewLikeUtils.getType(this.cipher).toString(),
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

  protected async edit() {
    if (this.cipher.reprompt && !(await this.passwordRepromptService.showPasswordPrompt())) {
      return;
    }

    await this.router.navigate(["/edit-cipher"], {
      queryParams: { cipherId: this.cipher.id, type: CipherViewLikeUtils.getType(this.cipher) },
    });
  }

  protected async delete() {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(this.cipher);
    if (!repromptPassed) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: { key: "deleteItemConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    await this.cipherService.softDeleteWithServer(this.cipher.id as CipherId, activeUserId);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("deletedItem"),
    });
  }

  async archive() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "archiveItem" },
      content: { key: "archiveItemConfirmDesc" },
      type: "info",
    });

    if (!confirmed) {
      return;
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherArchiveService.archiveWithServer(this.cipher.id as CipherId, activeUserId);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("itemWasSentToArchive"),
    });
  }
}
