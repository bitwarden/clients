import { DatePipe, Location } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import qrcodeParser from "qrcode-parser";
import { firstValueFrom } from "rxjs";
import { first } from "rxjs/operators";

import { AddEditComponent as BaseAddEditComponent } from "@bitwarden/angular/vault/components/add-edit.component";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { DialogService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { BrowserApi } from "../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../platform/popup/browser-popup-utils";
import { PopupCloseWarningService } from "../../../../popup/services/popup-close-warning.service";
import {
  BrowserFido2UserInterfaceSession,
  fido2PopoutSessionData$,
} from "../../../fido2/browser-fido2-user-interface.service";
import { VaultPopoutType, closeAddEditVaultItemPopout } from "../../utils/vault-popout-window";

@Component({
  selector: "app-vault-add-edit",
  templateUrl: "add-edit.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class AddEditComponent extends BaseAddEditComponent implements OnInit {
  currentUris: string[];
  showAttachments = true;
  openAttachmentsInPopup: boolean;
  showAutoFillOnPageLoadOptions: boolean;
  private singleActionKey: string;

  private fido2PopoutSessionData$ = fido2PopoutSessionData$();

  constructor(
    cipherService: CipherService,
    folderService: FolderService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    auditService: AuditService,
    stateService: StateService,
    collectionService: CollectionService,
    messagingService: MessagingService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    eventCollectionService: EventCollectionService,
    policyService: PolicyService,
    private popupCloseWarningService: PopupCloseWarningService,
    organizationService: OrganizationService,
    passwordRepromptService: PasswordRepromptService,
    logService: LogService,
    sendApiService: SendApiService,
    dialogService: DialogService,
    datePipe: DatePipe,
  ) {
    super(
      cipherService,
      folderService,
      i18nService,
      platformUtilsService,
      auditService,
      stateService,
      collectionService,
      messagingService,
      eventCollectionService,
      policyService,
      logService,
      passwordRepromptService,
      organizationService,
      sendApiService,
      dialogService,
      window,
      datePipe,
    );
  }

  async ngOnInit() {
    await super.ngOnInit();

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      if (params.cipherId) {
        this.cipherId = params.cipherId;
      }
      if (params.folderId) {
        this.folderId = params.folderId;
      }
      if (params.collectionId) {
        const collection = this.writeableCollections.find((c) => c.id === params.collectionId);
        if (collection != null) {
          this.collectionIds = [collection.id];
          this.organizationId = collection.organizationId;
        }
      }
      if (params.type) {
        const type = parseInt(params.type, null);
        this.type = type;
      }
      this.editMode = !params.cipherId;

      if (params.cloneMode != null) {
        this.cloneMode = params.cloneMode === "true";
      }
      if (params.selectedVault) {
        this.organizationId = params.selectedVault;
      }
      if (params.singleActionKey) {
        this.singleActionKey = params.singleActionKey;
      }
      await this.load();

      if (!this.editMode || this.cloneMode) {
        if (params.name && (this.cipher.name == null || this.cipher.name === "")) {
          this.cipher.name = params.name;
        }
        if (
          params.uri &&
          (this.cipher.login.uris[0].uri == null || this.cipher.login.uris[0].uri === "")
        ) {
          this.cipher.login.uris[0].uri = params.uri;
        }
      }

      this.openAttachmentsInPopup = BrowserPopupUtils.inPopup(window);
    });

    if (!this.editMode) {
      const tabs = await BrowserApi.tabsQuery({ windowType: "normal" });
      this.currentUris =
        tabs == null
          ? null
          : tabs.filter((tab) => tab.url != null && tab.url !== "").map((tab) => tab.url);
    }

    this.setFocus();

    if (BrowserPopupUtils.inPopout(window)) {
      this.popupCloseWarningService.enable();
    }
  }

  async load() {
    await super.load();
    this.showAutoFillOnPageLoadOptions =
      this.cipher.type === CipherType.Login &&
      (await this.stateService.getEnableAutoFillOnPageLoad());
  }

  async submit(): Promise<boolean> {
    const fido2SessionData = await firstValueFrom(this.fido2PopoutSessionData$);
    const { isFido2Session, sessionId, userVerification } = fido2SessionData;
    const inFido2PopoutWindow = BrowserPopupUtils.inPopout(window) && isFido2Session;
    if (
      inFido2PopoutWindow &&
      !(await this.handleFido2UserVerification(sessionId, userVerification))
    ) {
      return false;
    }

    const success = await super.submit();
    if (!success) {
      return false;
    }

    if (BrowserPopupUtils.inPopout(window)) {
      this.popupCloseWarningService.disable();
    }

    if (inFido2PopoutWindow) {
      BrowserFido2UserInterfaceSession.confirmNewCredentialResponse(
        sessionId,
        this.cipher.id,
        userVerification,
      );
      return true;
    }

    if (this.inAddEditPopoutWindow()) {
      this.messagingService.send("addEditCipherSubmitted");
      await closeAddEditVaultItemPopout(1000);
      return true;
    }

    if (this.cloneMode) {
      this.router.navigate(["/tabs/vault"]);
    } else {
      this.location.back();
    }
    return true;
  }

  attachments() {
    super.attachments();

    if (this.openAttachmentsInPopup) {
      const destinationUrl = this.router
        .createUrlTree(["/attachments"], { queryParams: { cipherId: this.cipher.id } })
        .toString();
      const currentBaseUrl = window.location.href.replace(this.router.url, "");
      BrowserPopupUtils.openCurrentPagePopout(window, currentBaseUrl + destinationUrl);
    } else {
      this.router.navigate(["/attachments"], { queryParams: { cipherId: this.cipher.id } });
    }
  }

  editCollections() {
    super.editCollections();
    if (this.cipher.organizationId != null) {
      this.router.navigate(["/collections"], { queryParams: { cipherId: this.cipher.id } });
    }
  }

  async cancel() {
    super.cancel();

    const sessionData = await firstValueFrom(this.fido2PopoutSessionData$);
    if (BrowserPopupUtils.inPopout(window) && sessionData.isFido2Session) {
      this.popupCloseWarningService.disable();
      BrowserFido2UserInterfaceSession.abortPopout(sessionData.sessionId);
      return;
    }

    if (this.inAddEditPopoutWindow()) {
      closeAddEditVaultItemPopout();
      return;
    }

    this.location.back();
  }

  async generateUsername(): Promise<boolean> {
    const confirmed = await super.generateUsername();
    if (confirmed) {
      await this.saveCipherState();
      this.router.navigate(["generator"], { queryParams: { type: "username" } });
    }
    return confirmed;
  }

  async generatePassword(): Promise<boolean> {
    const confirmed = await super.generatePassword();
    if (confirmed) {
      await this.saveCipherState();
      this.router.navigate(["generator"], { queryParams: { type: "password" } });
    }
    return confirmed;
  }

  async delete(): Promise<boolean> {
    const confirmed = await super.delete();
    if (confirmed) {
      this.router.navigate(["/tabs/vault"]);
    }
    return confirmed;
  }

  toggleUriInput(uri: LoginUriView) {
    const u = uri as any;
    u.showCurrentUris = !u.showCurrentUris;
  }

  allowOwnershipOptions(): boolean {
    return (
      (!this.editMode || this.cloneMode) &&
      this.ownershipOptions &&
      (this.ownershipOptions.length > 1 || !this.allowPersonal)
    );
  }

  private saveCipherState() {
    return this.stateService.setAddEditCipherInfo({
      cipher: this.cipher,
      collectionIds:
        this.collections == null
          ? []
          : this.collections.filter((c) => (c as any).checked).map((c) => c.id),
    });
  }

  private setFocus() {
    window.setTimeout(() => {
      if (this.editMode) {
        return;
      }

      if (this.cipher.name != null && this.cipher.name !== "") {
        document.getElementById("loginUsername").focus();
      } else {
        document.getElementById("name").focus();
      }
    }, 200);
  }

  private async handleFido2UserVerification(
    sessionId: string,
    userVerification: boolean,
  ): Promise<boolean> {
    // We are bypassing user verification pending implementation of PIN and biometric support.
    return true;
  }

  repromptChanged() {
    super.repromptChanged();

    if (!this.showAutoFillOnPageLoadOptions) {
      return;
    }

    if (this.reprompt) {
      this.platformUtilsService.showToast(
        "info",
        null,
        this.i18nService.t("passwordRepromptDisabledAutofillOnPageLoad"),
      );
      return;
    }

    this.platformUtilsService.showToast(
      "info",
      null,
      this.i18nService.t("autofillOnPageLoadSetToDefault"),
    );
  }

  private inAddEditPopoutWindow() {
    return BrowserPopupUtils.inSingleActionPopout(
      window,
      this.singleActionKey || VaultPopoutType.addEditVaultItem,
    );
  }

  async captureTOTPFromTab() {
    try {
      const screenshot = await BrowserApi.captureVisibleTab();
      const data = await qrcodeParser(screenshot);
      const url = new URL(data.toString());
      if (url.protocol == "otpauth:" && url.searchParams.has("secret")) {
        this.cipher.login.totp = data.toString();
        this.platformUtilsService.showToast(
          "success",
          null,
          this.i18nService.t("totpCaptureSuccess"),
        );
      }
    } catch (e) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("totpCaptureError"),
      );
    }
  }
}
