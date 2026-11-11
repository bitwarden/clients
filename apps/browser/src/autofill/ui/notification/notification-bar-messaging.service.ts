import { DestroyRef, inject, Injectable, signal } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BrowserApi } from "../../../platform/browser/browser-api";
import {
  NotificationBarIframeInitData,
  NotificationBarWindowMessage,
  NotificationType,
  NotificationTypes,
} from "../../notification/abstractions/notification-bar";
import { isAtRiskPasswordNotification } from "../../notification/utils";
import { applyAutofillPageTheme } from "../shared/bootstrap-autofill-page";

import {
  CollectionView,
  FolderView,
  NotificationBarState,
  NotificationCipher,
  NotificationSaveSelection,
  OrgView,
} from "./notification.types";

/** Placeholder value for "personal vault" and "no folder". */
const NONE = "0";

const CONFIRMATION_CLOSE_DELAY_MS = 5000;

/**
 * The notification bar page's connection to the extension. Receives init data from the content
 * script that hosts the iframe, fetches what the save view needs from the background, and turns
 * user actions into background messages.
 */
@Injectable()
export class NotificationBarMessagingService {
  private readonly i18nService = inject(I18nService);

  private readonly trustedParentOrigin = new URLSearchParams(globalThis.location.search).get(
    "parentOrigin",
  );
  private initData: NotificationBarIframeInitData = {};

  private readonly _state = signal<NotificationBarState | undefined>(undefined);
  readonly state = this._state.asReadonly();

  constructor() {
    globalThis.addEventListener("message", this.handleWindowMessage);
    inject(DestroyRef).onDestroy(() =>
      globalThis.removeEventListener("message", this.handleWindowMessage),
    );
    this.postMessageToParent({ command: "initNotificationBar" });
  }

  close() {
    void BrowserApi.sendMessage("bgCloseNotificationBar", {
      // FIXME (PM-33879): This value should be replaced with the resolved
      // user preference and/or removed entirely
      fadeOutNotification: true,
    });
  }

  save(selection: NotificationSaveSelection) {
    const state = this._state();
    if (state?.view === NotificationTypes.Unlock) {
      // The cipher id is not known while the vault is locked.
      this.sendSaveCipherMessage(null, true);
      this._state.set({ ...state, loading: true });
      return;
    }

    if (selection.vault.length > 1) {
      void BrowserApi.sendMessage("bgOpenAddEditVaultItemPopout", {
        organizationId: selection.vault,
        ...(selection.folder.length > 1 ? { folder: selection.folder } : {}),
      });
      this.close();
      return;
    }

    this.sendSaveCipherMessage(null, this.removeIndividualVault(), selection.folder);
  }

  /** Updates an existing login with the submitted credentials. */
  update(cipherId: string) {
    this.sendSaveCipherMessage(cipherId, false);
  }

  /** Opens the new login for review before it is saved. */
  edit() {
    this.sendSaveCipherMessage(null, true);
  }

  openVault() {
    const state = this._state();
    const cipherId = state?.view === "confirmation" ? state.cipherId : undefined;
    if (cipherId) {
      void BrowserApi.sendMessage("bgOpenViewVaultItemPopout", { cipherId });
      return;
    }
    void BrowserApi.sendMessage("bgOpenAddEditVaultItemPopout", {});
  }

  openTasks() {
    void BrowserApi.sendMessage("bgOpenAtRiskPasswords");
  }

  changePassword() {
    void BrowserApi.sendMessage("bgOpenChangePasswordUrl");
  }

  private readonly handleWindowMessage = (event: MessageEvent) => {
    if (event?.source !== globalThis.parent) {
      return;
    }

    const message = event.data as NotificationBarWindowMessage;
    if (!message?.command) {
      return;
    }

    if (!this.trustedParentOrigin || event.origin !== this.trustedParentOrigin) {
      return;
    }

    if (
      message.command === "initNotificationBar" &&
      message.parentOrigin &&
      message.parentOrigin !== event.origin
    ) {
      return;
    }

    if (message.command === "initNotificationBar") {
      void this.init(message);
    } else if (message.command === "saveCipherAttemptCompleted") {
      this.showConfirmation(message);
    }
  };

  private async init({ initData }: NotificationBarWindowMessage) {
    if (!initData) {
      return;
    }
    this.initData = initData;
    applyAutofillPageTheme(initData.theme);

    if (initData.isConfirmation) {
      this.showConfirmation({
        command: "saveCipherAttemptCompleted",
        data: initData.confirmationData,
      });
      return;
    }

    const type = this.resolveType();

    if (type === NotificationTypes.Unlock) {
      this.setTitle("unlockToSave");
      this._state.set({ view: NotificationTypes.Unlock });
      return;
    }

    if (isAtRiskPasswordNotification(initData)) {
      this.setTitle("atRiskPassword");
      this._state.set({
        view: NotificationTypes.AtRiskPassword,
        organizationName: initData.params.organizationName,
        passwordChangeUri: initData.params.hasPasswordChangeUri,
      });
      return;
    }

    if (type !== NotificationTypes.Add && type !== NotificationTypes.Change) {
      return;
    }

    this.setTitle(type === NotificationTypes.Add ? "saveLogin" : "updateLogin");
    const [organizations, folders, ciphers, collections] = await Promise.all([
      BrowserApi.sendMessageWithResponse<OrgView[]>("bgGetOrgData"),
      BrowserApi.sendMessageWithResponse<FolderView[]>("bgGetFolderData"),
      BrowserApi.sendMessageWithResponse<NotificationCipher[]>("bgGetDecryptedCiphers"),
      BrowserApi.sendMessageWithResponse<CollectionView[]>("bgGetCollectionData", {
        orgId: NONE,
      }),
    ]);

    this._state.set({
      view: type,
      ciphers,
      organizations,
      folders,
      collections,
      personalVaultAllowed: !this.removeIndividualVault(),
    });
  }

  private showConfirmation({ error, data }: NotificationBarWindowMessage) {
    const type = this.resolveType();
    const confirmationType =
      type === NotificationTypes.Change ? NotificationTypes.Change : NotificationTypes.Add;

    if (error) {
      this.setTitle("saveFailure");
    } else {
      this.setTitle(
        confirmationType === NotificationTypes.Add ? "loginSaveSuccess" : "loginUpdateSuccess",
      );
    }

    this._state.set({
      view: "confirmation",
      type: confirmationType,
      itemName: data?.itemName ?? this.i18nService.t("typeLogin"),
      cipherId: data?.cipherId,
      error,
      task: data?.task,
    });

    globalThis.setTimeout(
      () => void BrowserApi.sendMessage("bgCloseNotificationBar"),
      CONFIRMATION_CLOSE_DELAY_MS,
    );
  }

  /** A locked vault always asks to unlock first. */
  private resolveType(): NotificationType | undefined {
    return this.initData.isVaultLocked ? NotificationTypes.Unlock : this.initData.type;
  }

  private removeIndividualVault() {
    return Boolean(this.initData.removeIndividualVault);
  }

  private sendSaveCipherMessage(cipherId: string | null, edit: boolean, folder?: string) {
    void BrowserApi.sendMessage("bgSaveCipher", { cipherId, folder, edit });
  }

  /** Mirrors the header in the document title, for screen readers announcing the frame. */
  private setTitle(key: string) {
    const baseTitle = globalThis.document.title.split(" - ")[0];
    globalThis.document.title = `${baseTitle} - ${this.i18nService.t(key)}`;
  }

  private postMessageToParent(message: NotificationBarWindowMessage) {
    if (!this.trustedParentOrigin) {
      return;
    }
    globalThis.parent.postMessage(message, this.trustedParentOrigin);
  }
}
