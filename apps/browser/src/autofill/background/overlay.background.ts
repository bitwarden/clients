import { firstValueFrom } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { SHOW_AUTOFILL_BUTTON } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { InlineMenuVisibilitySetting } from "@bitwarden/common/autofill/types";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { buildCipherIcon } from "@bitwarden/common/vault/icon/build-cipher-icon";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { openUnlockPopout } from "../../auth/popup/utils/auth-popout-window";
import { BrowserApi } from "../../platform/browser/browser-api";
import {
  openViewVaultItemPopout,
  openAddEditVaultItemPopout,
} from "../../vault/popup/utils/vault-popout-window";
import { AutofillService, PageDetail } from "../services/abstractions/autofill.service";
import { AutofillOverlayElement, AutofillOverlayPort } from "../utils/autofill-overlay.enum";

import { LockedVaultPendingNotificationsData } from "./abstractions/notification.background";
import {
  FocusedFieldData,
  OverlayBackgroundExtensionMessageHandlers,
  OverlayButtonPortMessageHandlers,
  OverlayCipherData,
  OverlayListPortMessageHandlers,
  OverlayBackground as OverlayBackgroundInterface,
  OverlayBackgroundExtensionMessage,
  OverlayAddNewItemMessage,
  OverlayPortMessage,
  WebsiteIconData,
} from "./abstractions/overlay.background";

class OverlayBackground implements OverlayBackgroundInterface {
  private readonly openUnlockPopout = openUnlockPopout;
  private readonly openViewVaultItemPopout = openViewVaultItemPopout;
  private readonly openAddEditVaultItemPopout = openAddEditVaultItemPopout;
  private overlayLoginCiphers: Map<string, CipherView> = new Map();
  private pageDetailsForTab: Record<
    chrome.runtime.MessageSender["tab"]["id"],
    Map<chrome.runtime.MessageSender["frameId"], PageDetail>
  > = {};
  private userAuthStatus: AuthenticationStatus = AuthenticationStatus.LoggedOut;
  private overlayButtonPort: chrome.runtime.Port;
  private overlayListPort: chrome.runtime.Port;
  private expiredPorts: chrome.runtime.Port[] = [];
  private focusedFieldData: FocusedFieldData;
  private overlayPageTranslations: Record<string, string>;
  private iconsServerUrl: string;
  private readonly extensionMessageHandlers: OverlayBackgroundExtensionMessageHandlers = {
    openAutofillOverlay: () => this.openOverlay(false),
    autofillOverlayElementClosed: ({ message, sender }) =>
      this.overlayElementClosed(message, sender),
    autofillOverlayAddNewVaultItem: ({ message, sender }) => this.addNewVaultItem(message, sender),
    getAutofillOverlayVisibility: () => this.getOverlayVisibility(),
    checkAutofillOverlayFocused: () => this.checkOverlayFocused(),
    focusAutofillOverlayList: () => this.focusOverlayList(),
    updateAutofillOverlayPosition: ({ message, sender }) =>
      this.updateOverlayPosition(message, sender),
    updateAutofillOverlayHidden: ({ message }) => this.updateOverlayHidden(message),
    updateFocusedFieldData: ({ message, sender }) => this.setFocusedFieldData(message, sender),
    collectPageDetailsResponse: ({ message, sender }) => this.storePageDetails(message, sender),
    unlockCompleted: ({ message }) => this.unlockCompleted(message),
    addedCipher: () => this.updateOverlayCiphers(),
    addEditCipherSubmitted: () => this.updateOverlayCiphers(),
    editedCipher: () => this.updateOverlayCiphers(),
    deletedCipher: () => this.updateOverlayCiphers(),
  };
  private readonly overlayButtonPortMessageHandlers: OverlayButtonPortMessageHandlers = {
    overlayButtonClicked: ({ port }) => this.handleOverlayButtonClicked(port),
    closeAutofillOverlay: ({ port }) => this.closeOverlay(port),
    forceCloseAutofillOverlay: ({ port }) => this.closeOverlay(port, true),
    overlayPageBlurred: () => this.checkOverlayListFocused(),
    redirectOverlayFocusOut: ({ message, port }) => this.redirectOverlayFocusOut(message, port),
  };
  private readonly overlayListPortMessageHandlers: OverlayListPortMessageHandlers = {
    checkAutofillOverlayButtonFocused: () => this.checkOverlayButtonFocused(),
    forceCloseAutofillOverlay: ({ port }) => this.closeOverlay(port, true),
    overlayPageBlurred: () => this.checkOverlayButtonFocused(),
    unlockVault: ({ port }) => this.unlockVault(port),
    fillSelectedListItem: ({ message, port }) => this.fillSelectedOverlayListItem(message, port),
    addNewVaultItem: ({ port }) => this.getNewVaultItemDetails(port),
    viewSelectedCipher: ({ message, port }) => this.viewSelectedCipher(message, port),
    redirectOverlayFocusOut: ({ message, port }) => this.redirectOverlayFocusOut(message, port),
  };

  constructor(
    private cipherService: CipherService,
    private autofillService: AutofillService,
    private authService: AuthService,
    private environmentService: EnvironmentService,
    private domainSettingsService: DomainSettingsService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private themeStateService: ThemeStateService,
  ) {}

  /**
   * Removes cached page details for a tab
   * based on the passed tabId.
   *
   * @param tabId - Used to reference the page details of a specific tab
   */
  removePageDetails(tabId: number) {
    if (!this.pageDetailsForTab[tabId]) {
      return;
    }

    this.pageDetailsForTab[tabId].clear();
    delete this.pageDetailsForTab[tabId];
  }

  /**
   * Sets up the extension message listeners and gets the settings for the
   * overlay's visibility and the user's authentication status.
   */
  async init() {
    this.setupExtensionMessageListeners();
    const env = await firstValueFrom(this.environmentService.environment$);
    this.iconsServerUrl = env.getIconsUrl();
    await this.getOverlayVisibility();
    await this.getAuthStatus();
  }

  /**
   * Updates the overlay list's ciphers and sends the updated list to the overlay list iframe.
   * Queries all ciphers for the given url, and sorts them by last used. Will not update the
   * list of ciphers if the extension is not unlocked.
   */
  async updateOverlayCiphers() {
    const authStatus = await firstValueFrom(this.authService.activeAccountStatus$);
    if (authStatus !== AuthenticationStatus.Unlocked) {
      return;
    }

    const currentTab = await BrowserApi.getTabFromCurrentWindowId();
    if (!currentTab?.url) {
      return;
    }

    this.overlayLoginCiphers = new Map();
    const ciphersViews = (await this.cipherService.getAllDecryptedForUrl(currentTab.url)).sort(
      (a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b),
    );
    for (let cipherIndex = 0; cipherIndex < ciphersViews.length; cipherIndex++) {
      this.overlayLoginCiphers.set(`overlay-cipher-${cipherIndex}`, ciphersViews[cipherIndex]);
    }

    const ciphers = await this.getOverlayCipherData();
    this.overlayListPort?.postMessage({ command: "updateOverlayListCiphers", ciphers });
    await BrowserApi.tabSendMessageData(currentTab, "updateIsOverlayCiphersPopulated", {
      isOverlayCiphersPopulated: Boolean(ciphers.length),
    });
  }

  /**
   * Strips out unnecessary data from the ciphers and returns an array of
   * objects that contain the cipher data needed for the overlay list.
   */
  private async getOverlayCipherData(): Promise<OverlayCipherData[]> {
    const showFavicons = await firstValueFrom(this.domainSettingsService.showFavicons$);
    const overlayCiphersArray = Array.from(this.overlayLoginCiphers);
    const overlayCipherData: OverlayCipherData[] = [];
    let loginCipherIcon: WebsiteIconData;

    for (let cipherIndex = 0; cipherIndex < overlayCiphersArray.length; cipherIndex++) {
      const [overlayCipherId, cipher] = overlayCiphersArray[cipherIndex];
      if (!loginCipherIcon && cipher.type === CipherType.Login) {
        loginCipherIcon = buildCipherIcon(this.iconsServerUrl, cipher, showFavicons);
      }

      overlayCipherData.push({
        id: overlayCipherId,
        name: cipher.name,
        type: cipher.type,
        reprompt: cipher.reprompt,
        favorite: cipher.favorite,
        icon:
          cipher.type === CipherType.Login
            ? loginCipherIcon
            : buildCipherIcon(this.iconsServerUrl, cipher, showFavicons),
        login: cipher.type === CipherType.Login ? { username: cipher.login.username } : null,
        card: cipher.type === CipherType.Card ? cipher.card.subTitle : null,
      });
    }

    return overlayCipherData;
  }

  /**
   * Handles aggregation of page details for a tab. Stores the page details
   * in association with the tabId of the tab that sent the message.
   *
   * @param message - Message received from the `collectPageDetailsResponse` command
   * @param sender - The sender of the message
   */
  private storePageDetails(
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    const pageDetails = {
      frameId: sender.frameId,
      tab: sender.tab,
      details: message.details,
    };

    const pageDetailsMap = this.pageDetailsForTab[sender.tab.id];
    if (!pageDetailsMap) {
      this.pageDetailsForTab[sender.tab.id] = new Map([[sender.frameId, pageDetails]]);
      return;
    }

    pageDetailsMap.set(sender.frameId, pageDetails);
  }

  /**
   * Triggers autofill for the selected cipher in the overlay list. Also places
   * the selected cipher at the top of the list of ciphers.
   *
   * @param overlayCipherId - Cipher ID corresponding to the overlayLoginCiphers map. Does not correspond to the actual cipher's ID.
   * @param sender - The sender of the port message
   */
  private async fillSelectedOverlayListItem(
    { overlayCipherId }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    const pageDetails = this.pageDetailsForTab[sender.tab.id];
    if (!overlayCipherId || !pageDetails?.size) {
      return;
    }

    const cipher = this.overlayLoginCiphers.get(overlayCipherId);

    if (await this.autofillService.isPasswordRepromptRequired(cipher, sender.tab)) {
      return;
    }
    const totpCode = await this.autofillService.doAutoFill({
      tab: sender.tab,
      cipher: cipher,
      pageDetails: Array.from(pageDetails.values()),
      fillNewPassword: true,
      allowTotpAutofill: true,
    });

    if (totpCode) {
      this.platformUtilsService.copyToClipboard(totpCode);
    }

    this.overlayLoginCiphers = new Map([[overlayCipherId, cipher], ...this.overlayLoginCiphers]);
  }

  /**
   * Checks if the overlay is focused. Will check the overlay list
   * if it is open, otherwise it will check the overlay button.
   */
  private checkOverlayFocused() {
    if (this.overlayListPort) {
      this.checkOverlayListFocused();

      return;
    }

    this.checkOverlayButtonFocused();
  }

  /**
   * Posts a message to the overlay button iframe to check if it is focused.
   */
  private checkOverlayButtonFocused() {
    this.overlayButtonPort?.postMessage({ command: "checkAutofillOverlayButtonFocused" });
  }

  /**
   * Posts a message to the overlay list iframe to check if it is focused.
   */
  private checkOverlayListFocused() {
    this.overlayListPort?.postMessage({ command: "checkAutofillOverlayListFocused" });
  }

  /**
   * Sends a message to the sender tab to close the autofill overlay.
   *
   * @param sender - The sender of the port message
   * @param forceCloseOverlay - Identifies whether the overlay should be force closed
   */
  private closeOverlay({ sender }: chrome.runtime.Port, forceCloseOverlay = false) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    BrowserApi.tabSendMessageData(sender.tab, "closeAutofillOverlay", { forceCloseOverlay });
  }

  /**
   * Handles cleanup when an overlay element is closed. Disconnects
   * the list and button ports and sets them to null.
   *
   * @param overlayElement - The overlay element that was closed, either the list or button
   * @param sender - The sender of the port message
   */
  private overlayElementClosed(
    { overlayElement }: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (sender.tab.id !== this.focusedFieldData?.tabId) {
      this.expiredPorts.forEach((port) => port.disconnect());
      this.expiredPorts = [];
      return;
    }

    if (overlayElement === AutofillOverlayElement.Button) {
      this.overlayButtonPort?.disconnect();
      this.overlayButtonPort = null;

      return;
    }

    this.overlayListPort?.disconnect();
    this.overlayListPort = null;
  }

  /**
   * Updates the position of either the overlay list or button. The position
   * is based on the focused field's position and dimensions.
   *
   * @param overlayElement - The overlay element to update, either the list or button
   * @param sender - The sender of the port message
   */
  private updateOverlayPosition(
    { overlayElement }: { overlayElement?: string },
    sender: chrome.runtime.MessageSender,
  ) {
    if (!overlayElement || sender.tab.id !== this.focusedFieldData?.tabId) {
      return;
    }

    if (overlayElement === AutofillOverlayElement.Button) {
      this.overlayButtonPort?.postMessage({
        command: "updateIframePosition",
        styles: this.getOverlayButtonPosition(),
      });

      return;
    }

    this.overlayListPort?.postMessage({
      command: "updateIframePosition",
      styles: this.getOverlayListPosition(),
    });
  }

  /**
   * Gets the position of the focused field and calculates the position
   * of the overlay button based on the focused field's position and dimensions.
   */
  private getOverlayButtonPosition() {
    if (!this.focusedFieldData) {
      return;
    }

    const { top, left, width, height } = this.focusedFieldData.focusedFieldRects;
    const { paddingRight, paddingLeft } = this.focusedFieldData.focusedFieldStyles;
    let elementOffset = height * 0.37;
    if (height >= 35) {
      elementOffset = height >= 50 ? height * 0.47 : height * 0.42;
    }

    const elementHeight = height - elementOffset;
    const elementTopPosition = top + elementOffset / 2;
    let elementLeftPosition = left + width - height + elementOffset / 2;

    const fieldPaddingRight = parseInt(paddingRight, 10);
    const fieldPaddingLeft = parseInt(paddingLeft, 10);
    if (fieldPaddingRight > fieldPaddingLeft) {
      elementLeftPosition = left + width - height - (fieldPaddingRight - elementOffset + 2);
    }

    return {
      top: `${Math.round(elementTopPosition)}px`,
      left: `${Math.round(elementLeftPosition)}px`,
      height: `${Math.round(elementHeight)}px`,
      width: `${Math.round(elementHeight)}px`,
    };
  }

  /**
   * Gets the position of the focused field and calculates the position
   * of the overlay list based on the focused field's position and dimensions.
   */
  private getOverlayListPosition() {
    if (!this.focusedFieldData) {
      return;
    }

    const { top, left, width, height } = this.focusedFieldData.focusedFieldRects;
    return {
      width: `${Math.round(width)}px`,
      top: `${Math.round(top + height)}px`,
      left: `${Math.round(left)}px`,
    };
  }

  /**
   * Sets the focused field data to the data passed in the extension message.
   *
   * @param focusedFieldData - Contains the rects and styles of the focused field.
   * @param sender - The sender of the extension message
   */
  private setFocusedFieldData(
    { focusedFieldData }: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    this.focusedFieldData = { ...focusedFieldData, tabId: sender.tab.id };
  }

  /**
   * Updates the overlay's visibility based on the display property passed in the extension message.
   *
   * @param display - The display property of the overlay, either "block" or "none"
   */
  private updateOverlayHidden({ display }: OverlayBackgroundExtensionMessage) {
    if (!display) {
      return;
    }

    const portMessage = { command: "updateOverlayHidden", styles: { display } };

    this.overlayButtonPort?.postMessage(portMessage);
    this.overlayListPort?.postMessage(portMessage);
  }

  /**
   * Sends a message to the currently active tab to open the autofill overlay.
   *
   * @param isFocusingFieldElement - Identifies whether the field element should be focused when the overlay is opened
   * @param isOpeningFullOverlay - Identifies whether the full overlay should be forced open regardless of other states
   */
  private async openOverlay(isFocusingFieldElement = false, isOpeningFullOverlay = false) {
    const currentTab = await BrowserApi.getTabFromCurrentWindowId();

    await BrowserApi.tabSendMessageData(currentTab, "openAutofillOverlay", {
      isFocusingFieldElement,
      isOpeningFullOverlay,
      authStatus: await this.getAuthStatus(),
    });
  }

  /**
   * Gets the overlay's visibility setting from the settings service.
   */
  private async getOverlayVisibility(): Promise<InlineMenuVisibilitySetting> {
    return await firstValueFrom(this.autofillSettingsService.inlineMenuVisibility$);
  }

  /**
   * Gets the user's authentication status from the auth service. If the user's
   * authentication status has changed, the overlay button's authentication status
   * will be updated and the overlay list's ciphers will be updated.
   */
  private async getAuthStatus() {
    const formerAuthStatus = this.userAuthStatus;
    this.userAuthStatus = await this.authService.getAuthStatus();

    if (
      this.userAuthStatus !== formerAuthStatus &&
      this.userAuthStatus === AuthenticationStatus.Unlocked
    ) {
      this.updateOverlayButtonAuthStatus();
      await this.updateOverlayCiphers();
    }

    return this.userAuthStatus;
  }

  /**
   * Sends a message to the overlay button to update its authentication status.
   */
  private updateOverlayButtonAuthStatus() {
    this.overlayButtonPort?.postMessage({
      command: "updateOverlayButtonAuthStatus",
      authStatus: this.userAuthStatus,
    });
  }

  /**
   * Handles the overlay button being clicked. If the user is not authenticated,
   * the vault will be unlocked. If the user is authenticated, the overlay will
   * be opened.
   *
   * @param port - The port of the overlay button
   */
  private handleOverlayButtonClicked(port: chrome.runtime.Port) {
    if (this.userAuthStatus !== AuthenticationStatus.Unlocked) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.unlockVault(port);
      return;
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.openOverlay(false, true);
  }

  /**
   * Facilitates opening the unlock popout window.
   *
   * @param port - The port of the overlay list
   */
  private async unlockVault(port: chrome.runtime.Port) {
    const { sender } = port;

    this.closeOverlay(port);
    const retryMessage: LockedVaultPendingNotificationsData = {
      commandToRetry: { message: { command: "openAutofillOverlay" }, sender },
      target: "overlay.background",
    };
    await BrowserApi.tabSendMessageData(
      sender.tab,
      "addToLockedVaultPendingNotifications",
      retryMessage,
    );
    await this.openUnlockPopout(sender.tab, true);
  }

  /**
   * Triggers the opening of a vault item popout window associated
   * with the passed cipher ID.
   * @param overlayCipherId - Cipher ID corresponding to the overlayLoginCiphers map. Does not correspond to the actual cipher's ID.
   * @param sender - The sender of the port message
   */
  private async viewSelectedCipher(
    { overlayCipherId }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    const cipher = this.overlayLoginCiphers.get(overlayCipherId);
    if (!cipher) {
      return;
    }

    await this.openViewVaultItemPopout(sender.tab, {
      cipherId: cipher.id,
      action: SHOW_AUTOFILL_BUTTON,
    });
  }

  /**
   * Facilitates redirecting focus to the overlay list.
   */
  private focusOverlayList() {
    this.overlayListPort?.postMessage({ command: "focusOverlayList" });
  }

  /**
   * Updates the authentication status for the user and opens the overlay if
   * a followup command is present in the message.
   *
   * @param message - Extension message received from the `unlockCompleted` command
   */
  private async unlockCompleted(message: OverlayBackgroundExtensionMessage) {
    await this.getAuthStatus();

    if (message.data?.commandToRetry?.message?.command === "openAutofillOverlay") {
      await this.openOverlay(true);
    }
  }

  /**
   * Gets the translations for the overlay page.
   */
  private getTranslations() {
    if (!this.overlayPageTranslations) {
      this.overlayPageTranslations = {
        locale: BrowserApi.getUILanguage(),
        opensInANewWindow: this.i18nService.translate("opensInANewWindow"),
        buttonPageTitle: this.i18nService.translate("bitwardenOverlayButton"),
        toggleBitwardenVaultOverlay: this.i18nService.translate("toggleBitwardenVaultOverlay"),
        listPageTitle: this.i18nService.translate("bitwardenVault"),
        unlockYourAccount: this.i18nService.translate("unlockYourAccountToViewMatchingLogins"),
        unlockAccount: this.i18nService.translate("unlockAccount"),
        fillCredentialsFor: this.i18nService.translate("fillCredentialsFor"),
        partialUsername: this.i18nService.translate("partialUsername"),
        view: this.i18nService.translate("view"),
        noItemsToShow: this.i18nService.translate("noItemsToShow"),
        newItem: this.i18nService.translate("newItem"),
        addNewVaultItem: this.i18nService.translate("addNewVaultItem"),
      };
    }

    return this.overlayPageTranslations;
  }

  /**
   * Facilitates redirecting focus out of one of the
   *  overlay elements to elements on the page.
   *
   * @param direction - The direction to redirect focus to (either "next", "previous" or "current)
   * @param sender - The sender of the port message
   */
  private redirectOverlayFocusOut(
    { direction }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    if (!direction) {
      return;
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    BrowserApi.tabSendMessageData(sender.tab, "redirectOverlayFocusOut", { direction });
  }

  /**
   * Triggers adding a new vault item from the overlay. Gathers data
   * input by the user before calling to open the add/edit window.
   *
   * @param sender - The sender of the port message
   */
  private getNewVaultItemDetails({ sender }: chrome.runtime.Port) {
    void BrowserApi.tabSendMessage(sender.tab, { command: "addNewVaultItemFromOverlay" });
  }

  /**
   * Handles adding a new vault item from the overlay. Gathers data login
   * data captured in the extension message.
   *
   * @param login - The login data captured from the extension message
   * @param sender - The sender of the extension message
   */
  private async addNewVaultItem(
    { login }: OverlayAddNewItemMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (!login) {
      return;
    }

    const uriView = new LoginUriView();
    uriView.uri = login.uri;

    const loginView = new LoginView();
    loginView.uris = [uriView];
    loginView.username = login.username || "";
    loginView.password = login.password || "";

    const cipherView = new CipherView();
    cipherView.name = (Utils.getHostname(login.uri) || login.hostname).replace(/^www\./, "");
    cipherView.folderId = null;
    cipherView.type = CipherType.Login;
    cipherView.login = loginView;

    await this.cipherService.setAddEditCipherInfo({
      cipher: cipherView,
      collectionIds: cipherView.collectionIds,
    });

    await this.openAddEditVaultItemPopout(sender.tab, { cipherId: cipherView.id });
    await BrowserApi.sendMessage("inlineAutofillMenuRefreshAddEditCipher");
  }

  /**
   * Sets up the extension message listeners for the overlay.
   */
  private setupExtensionMessageListeners() {
    BrowserApi.messageListener("overlay.background", this.handleExtensionMessage);
    BrowserApi.addListener(chrome.runtime.onConnect, this.handlePortOnConnect);
  }

  /**
   * Handles extension messages sent to the extension background.
   *
   * @param message - The message received from the extension
   * @param sender - The sender of the message
   * @param sendResponse - The response to send back to the sender
   */
  private handleExtensionMessage = (
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => {
    const handler: CallableFunction | undefined = this.extensionMessageHandlers[message?.command];
    if (!handler) {
      return;
    }

    const messageResponse = handler({ message, sender });
    if (!messageResponse) {
      return;
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.resolve(messageResponse).then((response) => sendResponse(response));
    return true;
  };

  /**
   * Handles the connection of a port to the extension background.
   *
   * @param port - The port that connected to the extension background
   */
  private handlePortOnConnect = async (port: chrome.runtime.Port) => {
    const isOverlayListPort = port.name === AutofillOverlayPort.List;
    const isOverlayButtonPort = port.name === AutofillOverlayPort.Button;
    if (!isOverlayListPort && !isOverlayButtonPort) {
      return;
    }

    this.storeOverlayPort(port);
    port.onMessage.addListener(this.handleOverlayElementPortMessage);
    port.postMessage({
      command: `initAutofillOverlay${isOverlayListPort ? "List" : "Button"}`,
      authStatus: await this.getAuthStatus(),
      styleSheetUrl: chrome.runtime.getURL(`overlay/${isOverlayListPort ? "list" : "button"}.css`),
      theme: await firstValueFrom(this.themeStateService.selectedTheme$),
      translations: this.getTranslations(),
      ciphers: isOverlayListPort ? await this.getOverlayCipherData() : null,
    });
    this.updateOverlayPosition(
      {
        overlayElement: isOverlayListPort
          ? AutofillOverlayElement.List
          : AutofillOverlayElement.Button,
      },
      port.sender,
    );
  };

  /**
   * Stores the connected overlay port and sets up any existing ports to be disconnected.
   *
   * @param port - The port to store
|   */
  private storeOverlayPort(port: chrome.runtime.Port) {
    if (port.name === AutofillOverlayPort.List) {
      this.storeExpiredOverlayPort(this.overlayListPort);
      this.overlayListPort = port;
      return;
    }

    if (port.name === AutofillOverlayPort.Button) {
      this.storeExpiredOverlayPort(this.overlayButtonPort);
      this.overlayButtonPort = port;
    }
  }

  /**
   * When registering a new connection, we want to ensure that the port is disconnected.
   * This method places an existing port in the expiredPorts array to be disconnected
   * at a later time.
   *
   * @param port - The port to store in the expiredPorts array
   */
  private storeExpiredOverlayPort(port: chrome.runtime.Port | null) {
    if (port) {
      this.expiredPorts.push(port);
    }
  }

  /**
   * Handles messages sent to the overlay list or button ports.
   *
   * @param message - The message received from the port
   * @param port - The port that sent the message
   */
  private handleOverlayElementPortMessage = (
    message: OverlayBackgroundExtensionMessage,
    port: chrome.runtime.Port,
  ) => {
    const command = message?.command;
    let handler: CallableFunction | undefined;

    if (port.name === AutofillOverlayPort.Button) {
      handler = this.overlayButtonPortMessageHandlers[command];
    }

    if (port.name === AutofillOverlayPort.List) {
      handler = this.overlayListPortMessageHandlers[command];
    }

    if (!handler) {
      return;
    }

    handler({ message, port });
  };
}

export default OverlayBackground;
