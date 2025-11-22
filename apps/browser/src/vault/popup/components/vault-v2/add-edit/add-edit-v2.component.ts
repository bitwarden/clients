// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { firstValueFrom, map, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType, toCipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { AddEditCipherInfo } from "@bitwarden/common/vault/types/add-edit-cipher-info";
import {
  AsyncActionsModule,
  ButtonModule,
  SearchModule,
  IconButtonModule,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import {
  CipherFormConfig,
  CipherFormConfigService,
  CipherFormGenerationService,
  CipherFormMode,
  CipherFormModule,
  DefaultCipherFormConfigService,
  OptionalInitialValues,
  TotpCaptureService,
} from "@bitwarden/vault";

import { BrowserFido2UserInterfaceSession } from "../../../../../autofill/fido2/services/browser-fido2-user-interface.service";
import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { PopOutComponent } from "../../../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";
import { PopupRouterCacheService } from "../../../../../platform/popup/view-cache/popup-router-cache.service";
import { PopupCloseWarningService } from "../../../../../popup/services/popup-close-warning.service";
import { BrowserCipherFormGenerationService } from "../../../services/browser-cipher-form-generation.service";
import { BrowserPremiumUpgradePromptService } from "../../../services/browser-premium-upgrade-prompt.service";
import { BrowserTotpCaptureService } from "../../../services/browser-totp-capture.service";
import {
  fido2PopoutSessionData$,
  Fido2SessionData,
} from "../../../utils/fido2-popout-session-data";
import { VaultPopoutType } from "../../../utils/vault-popout-window";
import { OpenAttachmentsComponent } from "../attachments/open-attachments/open-attachments.component";

/**
 * Helper class to parse query parameters for the AddEdit route.
 */
class QueryParams {
  constructor(params: Params) {
    this.cipherId = params.cipherId;
    this.type = toCipherType(params.type);
    this.clone = params.clone === "true";
    this.folderId = params.folderId;
    this.organizationId = params.organizationId;
    this.collectionId = params.collectionId;
    this.uri = params.uri;
    this.username = params.username;
    this.name = params.name;
    this.prefillNameAndURIFromTab = params.prefillNameAndURIFromTab;
  }

  /**
   * The ID of the cipher to edit or clone.
   */
  cipherId?: CipherId;

  /**
   * The type of cipher to create.
   */
  type?: CipherType;

  /**
   * Whether to clone the cipher.
   */
  clone?: boolean;

  /**
   * Optional folderId to pre-select.
   */
  folderId?: string;

  /**
   * Optional organizationId to pre-select.
   */
  organizationId?: OrganizationId;

  /**
   * Optional collectionId to pre-select.
   */
  collectionId?: CollectionId;

  /**
   * Optional URI to pre-fill for login ciphers.
   */
  uri?: string;

  /**
   * Optional username to pre-fill for login/identity ciphers.
   */
  username?: string;

  /**
   * Optional name to pre-fill for the cipher.
   */
  name?: string;

  /**
   * Optional flag to pre-fill the name and URI from the current tab.
   * NOTE: This will override the `uri` and `name` query parameters if set to true.
   */
  prefillNameAndURIFromTab?: true;
}

export type AddEditQueryParams = Partial<Record<keyof QueryParams, string>>;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-add-edit-v2",
  templateUrl: "add-edit-v2.component.html",
  providers: [
    { provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService },
    { provide: TotpCaptureService, useClass: BrowserTotpCaptureService },
    { provide: CipherFormGenerationService, useClass: BrowserCipherFormGenerationService },
    { provide: PremiumUpgradePromptService, useClass: BrowserPremiumUpgradePromptService },
  ],
  imports: [
    CommonModule,
    SearchModule,
    JslibModule,
    FormsModule,
    ButtonModule,
    OpenAttachmentsComponent,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    CipherFormModule,
    AsyncActionsModule,
    PopOutComponent,
    IconButtonModule,
  ],
})
export class AddEditV2Component implements OnInit, OnDestroy {
  headerText: string;
  config: CipherFormConfig;
  canDeleteCipher$: Observable<boolean>;

  get loading() {
    return this.config == null;
  }

  get originalCipherId(): CipherId | null {
    return this.config?.originalCipher?.id as CipherId;
  }

  private fido2PopoutSessionData$ = fido2PopoutSessionData$();
  private fido2PopoutSessionData: Fido2SessionData;

  private get inFido2PopoutWindow() {
    return BrowserPopupUtils.inPopout(window) && this.fido2PopoutSessionData.isFido2Session;
  }

  private get inSingleActionPopout() {
    return BrowserPopupUtils.inSingleActionPopout(window, VaultPopoutType.addEditVaultItem);
  }

  constructor(
    private route: ActivatedRoute,
    private i18nService: I18nService,
    private addEditFormConfigService: CipherFormConfigService,
    private popupCloseWarningService: PopupCloseWarningService,
    private popupRouterCacheService: PopupRouterCacheService,
    private router: Router,
    private cipherService: CipherService,
    private eventCollectionService: EventCollectionService,
    private logService: LogService,
    private toastService: ToastService,
    private dialogService: DialogService,
    protected cipherAuthorizationService: CipherAuthorizationService,
    private accountService: AccountService,
  ) {
    this.subscribeToParams();
  }

  private messageListener: (message: any) => void;

  async ngOnInit() {
    this.fido2PopoutSessionData = await firstValueFrom(this.fido2PopoutSessionData$);

    if (BrowserPopupUtils.inPopout(window)) {
      this.popupCloseWarningService.enable();
    }

    // Listen for messages to reload cipher data when the pop up is already open
    this.messageListener = async (message: any) => {
      if (message?.command === "reloadAddEditCipherData") {
        await this.reloadCipherData();
      }
    };
    BrowserApi.addListener(chrome.runtime.onMessage, this.messageListener);
  }

  ngOnDestroy() {
    if (this.messageListener) {
      BrowserApi.removeListener(chrome.runtime.onMessage, this.messageListener);
    }
  }

  /**
   * Reloads the cipher data when the popup is already open and new form data is submitted.
   * This completely replaces the initialValues to clear any stale data from the previous submission.
   */
  private async reloadCipherData() {
    if (!this.config) {
      return;
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const latestCipherInfo = await firstValueFrom(
      this.cipherService.addEditCipherInfo$(activeUserId),
    );

    if (latestCipherInfo != null) {
      this.config = {
        ...this.config,
        initialValues: mapAddEditCipherInfoToInitialValues(latestCipherInfo),
      };

      // Be sure to clear the "cached" cipher info, so it doesn't get used again
      await this.cipherService.setAddEditCipherInfo(null, activeUserId);
    }
  }

  /**
   * Called before the form is submitted, allowing us to handle Fido2 user verification.
   */
  protected checkFido2UserVerification: () => Promise<boolean> = async () => {
    if (!this.inFido2PopoutWindow) {
      // Not in a Fido2 popout window, no need to handle user verification.
      return true;
    }

    // TODO use fido2 user verification service once user verification for passkeys is approved for production.
    // We are bypassing user verification pending approval for production.
    return true;
  };

  /**
   * Handle back button
   */
  handleBackButton = async () => {
    if (this.inFido2PopoutWindow) {
      this.popupCloseWarningService.disable();
      BrowserFido2UserInterfaceSession.abortPopout(this.fido2PopoutSessionData.sessionId);
      return;
    }

    if (this.inSingleActionPopout) {
      await BrowserPopupUtils.closeSingleActionPopout(VaultPopoutType.addEditVaultItem);
      return;
    }

    await this.popupRouterCacheService.back();
  };

  async onCipherSaved(cipher: CipherView) {
    if (BrowserPopupUtils.inPopout(window)) {
      this.popupCloseWarningService.disable();
    }

    if (this.inFido2PopoutWindow) {
      BrowserFido2UserInterfaceSession.confirmNewCredentialResponse(
        this.fido2PopoutSessionData.sessionId,
        cipher.id,
        this.fido2PopoutSessionData.userVerification,
      );
      return;
    }

    if (this.inSingleActionPopout) {
      await BrowserPopupUtils.closeSingleActionPopout(VaultPopoutType.addEditVaultItem, 1000);
      return;
    }

    // When the cipher is in edit / partial edit, the previous page was the view-cipher page.
    // In the case of creating a new cipher, the user should go view-cipher page but we need to also
    // remove it from the history stack. This avoids the user having to click back twice on the
    // view-cipher page.
    if (this.config.mode === "edit" || this.config.mode === "partial-edit") {
      await this.popupRouterCacheService.back();
    } else {
      await this.router.navigate(["/view-cipher"], {
        replaceUrl: true,
        queryParams: { cipherId: cipher.id },
      });
      // Clear popup history so after closing/reopening, Back won’t return to the add-edit form
      await this.popupRouterCacheService.setHistory([]);
    }
    await BrowserApi.sendMessage("addEditCipherSubmitted");
  }

  subscribeToParams(): void {
    this.route.queryParams
      .pipe(
        takeUntilDestroyed(),
        map((params) => new QueryParams(params)),
        switchMap(async (params) => {
          let mode: CipherFormMode;
          if (params.cipherId == null) {
            mode = "add";
          } else {
            mode = params.clone ? "clone" : "edit";
          }
          const config = await this.addEditFormConfigService.buildConfig(
            mode,
            params.cipherId,
            params.type,
          );

          if (config.mode === "edit" && !config.originalCipher.edit) {
            config.mode = "partial-edit";
          }
          config.initialValues = await this.setInitialValuesFromParams(params);

          const activeUserId = await firstValueFrom(
            this.accountService.activeAccount$.pipe(getUserId),
          );

          // The browser notification bar and overlay use addEditCipherInfo$ to pass modified cipher details to the form
          // Attempt to fetch them here and overwrite the initialValues if present
          const cachedCipherInfo = await firstValueFrom(
            this.cipherService.addEditCipherInfo$(activeUserId),
          );

          if (cachedCipherInfo != null) {
            // Cached cipher info has priority over queryParams
            config.initialValues = {
              ...config.initialValues,
              ...mapAddEditCipherInfoToInitialValues(cachedCipherInfo),
            };
            // Be sure to clear the "cached" cipher info, so it doesn't get used again
            await this.cipherService.setAddEditCipherInfo(null, activeUserId);
          }

          if (["edit", "partial-edit"].includes(config.mode) && config.originalCipher?.id) {
            this.canDeleteCipher$ = this.cipherAuthorizationService.canDeleteCipher$(
              config.originalCipher,
            );

            await this.eventCollectionService.collect(
              EventType.Cipher_ClientViewed,
              config.originalCipher.id,
              false,
              config.originalCipher.organizationId,
            );
          }

          return config;
        }),
      )
      .subscribe((config) => {
        this.config = config;
        this.headerText = this.setHeader(config.mode, config.cipherType);
      });
  }

  async setInitialValuesFromParams(params: QueryParams) {
    const initialValues = {} as OptionalInitialValues;
    if (params.folderId) {
      initialValues.folderId = params.folderId;
    }
    if (params.organizationId) {
      initialValues.organizationId = params.organizationId;
    }
    if (params.collectionId) {
      initialValues.collectionIds = [params.collectionId];
    }
    if (params.uri) {
      initialValues.loginUri = params.uri;
    }
    if (params.username) {
      initialValues.username = params.username;
    }
    if (params.name) {
      initialValues.name = params.name;
    }

    if (params.prefillNameAndURIFromTab) {
      const tab = await BrowserApi.getTabFromCurrentWindow();

      initialValues.loginUri = tab.url;
      initialValues.name = Utils.getHostname(tab.url);
    }

    return initialValues;
  }

  setHeader(mode: CipherFormMode, type: CipherType) {
    const isEditMode = mode === "edit" || mode === "partial-edit";
    const translation = {
      [CipherType.Login]: isEditMode ? "editItemHeaderLogin" : "newItemHeaderLogin",
      [CipherType.Card]: isEditMode ? "editItemHeaderCard" : "newItemHeaderCard",
      [CipherType.Identity]: isEditMode ? "editItemHeaderIdentity" : "newItemHeaderIdentity",
      [CipherType.SecureNote]: isEditMode ? "editItemHeaderNote" : "newItemHeaderNote",
      [CipherType.SshKey]: isEditMode ? "editItemHeaderSshKey" : "newItemHeaderSshKey",
    };
    return this.i18nService.t(translation[type]);
  }

  delete = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: {
        key: "deleteItemConfirmation",
      },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.deleteCipher(activeUserId);
    } catch (e) {
      this.logService.error(e);
      return false;
    }

    await this.router.navigate(["/tabs/vault"]);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("deletedItem"),
    });

    return true;
  };

  protected deleteCipher(userId: UserId) {
    return this.config.originalCipher.deletedDate
      ? this.cipherService.deleteWithServer(this.config.originalCipher.id, userId)
      : this.cipherService.softDeleteWithServer(this.config.originalCipher.id, userId);
  }
}

/**
 * Helper to map the old AddEditCipherInfo to the new OptionalInitialValues type used by the CipherForm
 * @param cipherInfo
 */
const mapAddEditCipherInfoToInitialValues = (
  cipherInfo: AddEditCipherInfo | null,
): OptionalInitialValues => {
  const initialValues: OptionalInitialValues = {};

  if (cipherInfo == null) {
    return initialValues;
  }

  if (cipherInfo.collectionIds != null) {
    initialValues.collectionIds = cipherInfo.collectionIds as CollectionId[];
  }

  if (cipherInfo.cipher == null) {
    return initialValues;
  }

  const cipher = cipherInfo.cipher;

  if (cipher.folderId != null) {
    initialValues.folderId = cipher.folderId;
  }

  if (cipher.organizationId != null) {
    initialValues.organizationId = cipher.organizationId as OrganizationId;
  }

  if (cipher.name != null) {
    initialValues.name = cipher.name;
  }

  if (cipher.type === CipherType.Card) {
    const card = cipher.card;

    if (card != null) {
      if (card.cardholderName != null) {
        initialValues.cardholderName = card.cardholderName;
      }

      if (card.number != null) {
        initialValues.number = card.number;
      }

      if (card.expMonth != null) {
        initialValues.expMonth = card.expMonth;
      }

      if (card.expYear != null) {
        initialValues.expYear = card.expYear;
      }

      if (card.code != null) {
        initialValues.code = card.code;
      }
    }
  }

  if (cipher.type === CipherType.Login) {
    const login = cipher.login;

    if (login != null) {
      if (login.uris != null && login.uris.length > 0) {
        initialValues.loginUri = login.uris[0].uri;
      }

      if (login.username != null) {
        initialValues.username = login.username;
      }

      if (login.password != null) {
        initialValues.password = login.password;
      }
    }
  }

  if (cipher.type === CipherType.Identity && cipher.identity?.username != null) {
    initialValues.username = cipher.identity.username;
  }

  if (cipher.type == CipherType.Identity) {
    const identity = cipher.identity;

    if (identity != null) {
      if (identity.title != null) {
        initialValues.title = identity.title;
      }

      if (identity.firstName != null) {
        initialValues.firstName = identity.firstName;
      }

      if (identity.middleName != null) {
        initialValues.middleName = identity.middleName;
      }

      if (identity.lastName != null) {
        initialValues.lastName = identity.lastName;
      }

      if (identity.company != null) {
        initialValues.company = identity.company;
      }

      if (identity.ssn != null) {
        initialValues.ssn = identity.ssn;
      }

      if (identity.passportNumber != null) {
        initialValues.passportNumber = identity.passportNumber;
      }

      if (identity.licenseNumber != null) {
        initialValues.licenseNumber = identity.licenseNumber;
      }

      if (identity.email != null) {
        initialValues.email = identity.email;
      }

      if (identity.phone != null) {
        initialValues.phone = identity.phone;
      }

      if (identity.address1 != null) {
        initialValues.address1 = identity.address1;
      }

      if (identity.address2 != null) {
        initialValues.address2 = identity.address2;
      }

      if (identity.address3 != null) {
        initialValues.address3 = identity.address3;
      }

      if (identity.city != null) {
        initialValues.city = identity.city;
      }

      if (identity.state != null) {
        initialValues.state = identity.state;
      }

      if (identity.postalCode != null) {
        initialValues.postalCode = identity.postalCode;
      }

      if (identity.country != null) {
        initialValues.country = identity.country;
      }
    }
  }

  return initialValues;
};
