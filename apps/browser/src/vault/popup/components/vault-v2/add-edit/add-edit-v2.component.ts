import { CommonModule, Location } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { firstValueFrom, map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { AsyncActionsModule, ButtonModule, SearchModule } from "@bitwarden/components";
import {
  CipherFormConfig,
  CipherFormConfigService,
  CipherFormMode,
  CipherFormModule,
  DefaultCipherFormConfigService,
  TotpCaptureService,
} from "@bitwarden/vault";

import BrowserPopupUtils from "../../../../../platform/popup/browser-popup-utils";
import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";
import { PopupCloseWarningService } from "../../../../../popup/services/popup-close-warning.service";
import { BrowserFido2UserInterfaceSession } from "../../../../fido2/browser-fido2-user-interface.service";
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
    this.type = params.type != undefined ? parseInt(params.type, null) : undefined;
    this.clone = params.clone === "true";
    this.folderId = params.folderId;
    this.organizationId = params.organizationId;
    this.collectionId = params.collectionId;
    this.uri = params.uri;
    this.username = params.username;
    this.name = params.name;
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
}

export type AddEditQueryParams = Partial<Record<keyof QueryParams, string>>;

@Component({
  selector: "app-add-edit-v2",
  templateUrl: "add-edit-v2.component.html",
  standalone: true,
  providers: [
    { provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService },
    { provide: TotpCaptureService, useClass: BrowserTotpCaptureService },
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
  ],
})
export class AddEditV2Component implements OnInit {
  headerText: string;
  config: CipherFormConfig;

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
    private location: Location,
    private i18nService: I18nService,
    private addEditFormConfigService: CipherFormConfigService,
    private router: Router,
    private popupCloseWarningService: PopupCloseWarningService,
  ) {
    this.subscribeToParams();
  }

  async ngOnInit() {
    this.fido2PopoutSessionData = await firstValueFrom(this.fido2PopoutSessionData$);

    if (BrowserPopupUtils.inPopout(window)) {
      this.popupCloseWarningService.enable();
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
   * Navigates to previous view or view-cipher path
   * depending on the history length.
   *
   * This can happen when history is lost due to the extension being
   * forced into a popout window.
   */
  async handleBackButton() {
    if (this.inFido2PopoutWindow) {
      this.popupCloseWarningService.disable();
      BrowserFido2UserInterfaceSession.abortPopout(this.fido2PopoutSessionData.sessionId);
      return;
    }

    if (this.inSingleActionPopout) {
      await BrowserPopupUtils.closeSingleActionPopout(VaultPopoutType.addEditVaultItem);
      return;
    }

    if (history.length === 1) {
      await this.router.navigate(["/view-cipher"], {
        queryParams: { cipherId: this.originalCipherId },
      });
    } else {
      this.location.back();
    }
  }

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

    this.location.back();
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

          this.setInitialValuesFromParams(params, config);

          return config;
        }),
      )
      .subscribe((config) => {
        this.config = config;
        this.headerText = this.setHeader(config.mode, config.cipherType);
      });
  }

  setInitialValuesFromParams(params: QueryParams, config: CipherFormConfig) {
    config.initialValues = {};
    if (params.folderId) {
      config.initialValues.folderId = params.folderId;
    }
    if (params.organizationId) {
      config.initialValues.organizationId = params.organizationId;
    }
    if (params.collectionId) {
      config.initialValues.collectionIds = [params.collectionId];
    }
    if (params.uri) {
      config.initialValues.loginUri = params.uri;
    }
    if (params.username) {
      config.initialValues.username = params.username;
    }
    if (params.name) {
      config.initialValues.name = params.name;
    }
  }

  setHeader(mode: CipherFormMode, type: CipherType) {
    const partOne = mode === "edit" || mode === "partial-edit" ? "editItemHeader" : "newItemHeader";

    switch (type) {
      case CipherType.Login:
        return this.i18nService.t(partOne, this.i18nService.t("typeLogin"));
      case CipherType.Card:
        return this.i18nService.t(partOne, this.i18nService.t("typeCard"));
      case CipherType.Identity:
        return this.i18nService.t(partOne, this.i18nService.t("typeIdentity"));
      case CipherType.SecureNote:
        return this.i18nService.t(partOne, this.i18nService.t("note"));
    }
  }
}
