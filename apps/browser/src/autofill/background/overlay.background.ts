// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  debounceTime,
  firstValueFrom,
  map,
  merge,
  Observable,
  ReplaySubject,
  Subject,
  switchMap,
  throttleTime,
} from "rxjs";
import { parse } from "tldts";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId, getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  AutofillOverlayVisibility,
  SHOW_AUTOFILL_BUTTON,
} from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { InlineMenuVisibilitySetting } from "@bitwarden/common/autofill/types";
import { parseYearMonthExpiry } from "@bitwarden/common/autofill/utils";
import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import {
  Fido2ActiveRequestEvents,
  Fido2ActiveRequestManager,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-active-request-manager.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { buildCipherIcon } from "@bitwarden/common/vault/icon/build-cipher-icon";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { openUnlockPopout } from "../../auth/popup/utils/auth-popout-window";
import { BrowserApi } from "../../platform/browser/browser-api";
// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import {
  openAddEditVaultItemPopout,
  openViewVaultItemPopout,
} from "../../vault/popup/utils/vault-popout-window";
import {
  AutofillOverlayElement,
  AutofillOverlayPort,
  InlineMenuAccountCreationFieldType,
  InlineMenuAccountCreationFieldTypes,
  InlineMenuFillType,
  InlineMenuFillTypes,
  MAX_SUB_FRAME_DEPTH,
} from "../enums/autofill-overlay.enum";
import AutofillField from "../models/autofill-field";
import { AutofillService, PageDetail } from "../services/abstractions/autofill.service";
import { InlineMenuFieldQualificationService } from "../services/abstractions/inline-menu-field-qualifications.service";
import {
  areKeyValuesNull,
  generateDomainMatchPatterns,
  generateRandomChars,
  isInvalidResponseStatusCode,
  rectHasSize,
  specialCharacterToKeyMap,
} from "../utils";

import { LockedVaultPendingNotificationsData } from "./abstractions/notification.background";
import { ModifyLoginCipherFormData } from "./abstractions/overlay-notifications.background";
import {
  BuildCipherDataParams,
  CloseInlineMenuMessage,
  CurrentAddNewItemData,
  FocusedFieldData,
  InlineMenuButtonPortMessageHandlers,
  InlineMenuCipherData,
  InlineMenuListPortMessageHandlers,
  InlineMenuPosition,
  NewCardCipherData,
  NewIdentityCipherData,
  NewLoginCipherData,
  OverlayAddNewItemMessage,
  OverlayBackground as OverlayBackgroundInterface,
  OverlayBackgroundExtensionMessage,
  OverlayBackgroundExtensionMessageHandlers,
  OverlayPortMessage,
  PageDetailsForTab,
  SubFrameOffsetData,
  SubFrameOffsetsForTab,
  ToggleInlineMenuHiddenMessage,
  UpdateInlineMenuVisibilityMessage,
  UpdateOverlayCiphersParams,
} from "./abstractions/overlay.background";

export class OverlayBackground implements OverlayBackgroundInterface {
  private readonly openUnlockPopout = openUnlockPopout;
  private readonly openViewVaultItemPopout = openViewVaultItemPopout;
  private readonly openAddEditVaultItemPopout = openAddEditVaultItemPopout;
  private readonly updateOverlayCiphers$ = new Subject<UpdateOverlayCiphersParams>();
  private readonly storeInlineMenuFido2Credentials$ = new ReplaySubject<number>(1);
  private readonly startInlineMenuDelayedClose$ = new Subject<void>();
  private readonly cancelInlineMenuDelayedClose$ = new Subject<boolean>();
  private readonly startInlineMenuFadeIn$ = new Subject<void>();
  private readonly cancelInlineMenuFadeIn$ = new Subject<boolean>();
  private readonly startUpdateInlineMenuPosition$ = new Subject<chrome.runtime.MessageSender>();
  private readonly cancelUpdateInlineMenuPosition$ = new Subject<void>();
  private readonly repositionInlineMenu$ = new Subject<chrome.runtime.MessageSender>();
  private readonly rebuildSubFrameOffsets$ = new Subject<chrome.runtime.MessageSender>();
  private readonly addNewVaultItem$ = new Subject<CurrentAddNewItemData>();
  private pageDetailsForTab: PageDetailsForTab = {};
  private subFrameOffsetsForTab: SubFrameOffsetsForTab = {};
  private portKeyForTab: Record<number, string> = {};
  private expiredPorts: chrome.runtime.Port[] = [];
  private inlineMenuButtonPort: chrome.runtime.Port;
  private inlineMenuButtonMessageConnectorPort: chrome.runtime.Port;
  private inlineMenuListPort: chrome.runtime.Port;
  private inlineMenuListMessageConnectorPort: chrome.runtime.Port;
  private inlineMenuCiphers: Map<string, CipherView> = new Map();
  private inlineMenuFido2Credentials: Set<string> = new Set();
  private inlineMenuPageTranslations: Record<string, string>;
  private inlineMenuPosition: InlineMenuPosition = {};
  private cardAndIdentityCiphers: Set<CipherView> | null = null;
  private currentInlineMenuCiphersCount: number = 0;
  private currentAddNewItemData: CurrentAddNewItemData;
  private focusedFieldData: FocusedFieldData;
  private allFieldData: AutofillField[];
  private isFieldCurrentlyFocused: boolean = false;
  private isFieldCurrentlyFilling: boolean = false;
  private isInlineMenuButtonVisible: boolean = false;
  private isInlineMenuListVisible: boolean = false;
  private showPasskeysLabelsWithinInlineMenu: boolean = false;
  private iconsServerUrl: string;
  private generatedPassword: string;
  private readonly validPortConnections: Set<string> = new Set([
    AutofillOverlayPort.Button,
    AutofillOverlayPort.ButtonMessageConnector,
    AutofillOverlayPort.List,
    AutofillOverlayPort.ListMessageConnector,
  ]);
  private readonly extensionMessageHandlers: OverlayBackgroundExtensionMessageHandlers = {
    autofillOverlayElementClosed: ({ message, sender }) =>
      this.overlayElementClosed(message, sender),
    autofillOverlayAddNewVaultItem: ({ message, sender }) => this.addNewVaultItem(message, sender),
    triggerAutofillOverlayReposition: ({ sender }) => this.triggerOverlayReposition(sender),
    checkIsInlineMenuCiphersPopulated: ({ sender }) =>
      this.checkIsInlineMenuCiphersPopulated(sender),
    updateFocusedFieldData: ({ message, sender }) => this.setFocusedFieldData(message, sender),
    updateIsFieldCurrentlyFocused: ({ message, sender }) =>
      this.updateIsFieldCurrentlyFocused(message, sender),
    checkIsFieldCurrentlyFocused: () => this.checkIsFieldCurrentlyFocused(),
    updateIsFieldCurrentlyFilling: ({ message }) => this.updateIsFieldCurrentlyFilling(message),
    checkIsFieldCurrentlyFilling: () => this.checkIsFieldCurrentlyFilling(),
    getAutofillInlineMenuVisibility: () => this.getInlineMenuVisibility(),
    openAutofillInlineMenu: ({ message, sender }) =>
      this.openInlineMenu(sender, message.isOpeningFullInlineMenu),
    getInlineMenuCardsVisibility: () => this.getInlineMenuCardsVisibility(),
    getInlineMenuIdentitiesVisibility: () => this.getInlineMenuIdentitiesVisibility(),
    closeAutofillInlineMenu: ({ message, sender }) => this.closeInlineMenu(sender, message),
    checkAutofillInlineMenuFocused: ({ sender }) => this.checkInlineMenuFocused(sender),
    focusAutofillInlineMenuList: () => this.focusInlineMenuList(),
    getAutofillInlineMenuPosition: () => this.getInlineMenuPosition(),
    updateAutofillInlineMenuElementIsVisibleStatus: ({ message, sender }) =>
      this.updateInlineMenuElementIsVisibleStatus(message, sender),
    checkIsAutofillInlineMenuButtonVisible: () => this.checkIsInlineMenuButtonVisible(),
    checkIsAutofillInlineMenuListVisible: () => this.checkIsInlineMenuListVisible(),
    getCurrentTabFrameId: ({ sender }) => this.getSenderFrameId(sender),
    updateSubFrameData: ({ message, sender }) => this.updateSubFrameData(message, sender),
    triggerSubFrameFocusInRebuild: ({ sender }) => this.triggerSubFrameFocusInRebuild(sender),
    destroyAutofillInlineMenuListeners: ({ message, sender }) =>
      this.triggerDestroyInlineMenuListeners(sender.tab, message.subFrameData.frameId),
    collectPageDetailsResponse: ({ message, sender }) => this.storePageDetails(message, sender),
    unlockCompleted: ({ message }) => this.unlockCompleted(message),
    doFullSync: () => this.updateOverlayCiphers(),
    addedCipher: () => this.updateOverlayCiphers(),
    addEditCipherSubmitted: () => this.updateOverlayCiphers(),
    editedCipher: () => this.updateOverlayCiphers(),
    vaultAutofillSuggestionUsed: ({ message }) =>
      this.handleVaultAutofillSuggestionUsed(message.cipherId),
    deletedCipher: () => this.updateOverlayCiphers(),
    bgSaveCipher: () => this.updateOverlayCiphers(),
    updateOverlayCiphers: () => this.updateOverlayCiphers(),
    fido2AbortRequest: ({ sender }) => this.abortFido2ActiveRequest(sender.tab.id),
  };
  private readonly inlineMenuButtonPortMessageHandlers: InlineMenuButtonPortMessageHandlers = {
    triggerDelayedAutofillInlineMenuClosure: () => this.startInlineMenuDelayedClose$.next(),
    autofillInlineMenuButtonClicked: ({ port }) => this.handleInlineMenuButtonClicked(port),
    autofillInlineMenuBlurred: () => this.checkInlineMenuListFocused(),
    redirectAutofillInlineMenuFocusOut: ({ message, port }) =>
      this.redirectInlineMenuFocusOut(message, port),
    updateAutofillInlineMenuColorScheme: () => this.updateInlineMenuButtonColorScheme(),
  };
  private readonly inlineMenuListPortMessageHandlers: InlineMenuListPortMessageHandlers = {
    checkAutofillInlineMenuButtonFocused: ({ port }) =>
      this.checkInlineMenuButtonFocused(port.sender),
    autofillInlineMenuBlurred: ({ port }) => this.checkInlineMenuButtonFocused(port.sender),
    unlockVault: ({ port }) => this.unlockVault(port),
    fillAutofillInlineMenuCipher: ({ message, port }) => this.fillInlineMenuCipher(message, port),
    addNewVaultItem: ({ message, port }) => this.getNewVaultItemDetails(message, port),
    viewSelectedCipher: ({ message, port }) => this.viewSelectedCipher(message, port),
    redirectAutofillInlineMenuFocusOut: ({ message, port }) =>
      this.redirectInlineMenuFocusOut(message, port),
    updateAutofillInlineMenuListHeight: ({ message }) => this.updateInlineMenuListHeight(message),
    refreshGeneratedPassword: () => this.updateGeneratedPassword(true),
    fillGeneratedPassword: ({ port }) => this.fillGeneratedPassword(port),
    refreshOverlayCiphers: () => this.updateOverlayCiphers(false),
  };

  constructor(
    private logService: LogService,
    private cipherService: CipherService,
    private autofillService: AutofillService,
    private authService: AuthService,
    private environmentService: EnvironmentService,
    private domainSettingsService: DomainSettingsService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private vaultSettingsService: VaultSettingsService,
    private fido2ActiveRequestManager: Fido2ActiveRequestManager,
    private inlineMenuFieldQualificationService: InlineMenuFieldQualificationService,
    private themeStateService: ThemeStateService,
    private totpService: TotpService,
    private accountService: AccountService,
    private generatePasswordCallback: () => Promise<string>,
    private addPasswordCallback: (password: string) => Promise<void>,
  ) {
    this.initOverlayEventObservables();
  }

  /**
   * Sets up the extension message listeners and gets the settings for the
   * overlay's visibility and the user's authentication status.
   */
  async init() {
    this.setupExtensionListeners();
    const env = await firstValueFrom(this.environmentService.environment$);
    this.iconsServerUrl = env.getIconsUrl();
  }

  /**
   * Initializes event observables that handle events which affect the overlay's behavior.
   */
  private initOverlayEventObservables() {
    this.updateOverlayCiphers$
      .pipe(
        throttleTime(100, null, { leading: true, trailing: true }),
        switchMap((updateOverlayCiphersParams) =>
          this.handleOverlayCiphersUpdate(updateOverlayCiphersParams),
        ),
      )
      .subscribe();
    this.storeInlineMenuFido2Credentials$
      .pipe(switchMap((tabId) => this.availablePasskeyAuthCredentials$(tabId)))
      .subscribe((credentials) => this.storeInlineMenuFido2Credentials(credentials));
    this.repositionInlineMenu$
      .pipe(
        debounceTime(1000),
        switchMap((sender) => this.repositionInlineMenu(sender)),
      )
      .subscribe();
    this.rebuildSubFrameOffsets$
      .pipe(
        throttleTime(100, null, { leading: true, trailing: true }),
        switchMap((sender) => this.rebuildSubFrameOffsets(sender)),
      )
      .subscribe();
    this.addNewVaultItem$
      .pipe(
        debounceTime(100),
        switchMap((addNewItemData) =>
          this.buildCipherAndOpenAddEditVaultItemPopout(addNewItemData),
        ),
      )
      .subscribe();

    // Delayed close of the inline menu
    merge(
      this.startInlineMenuDelayedClose$.pipe(debounceTime(100)),
      this.cancelInlineMenuDelayedClose$,
    )
      .pipe(switchMap((cancelSignal) => this.triggerDelayedInlineMenuClosure(!!cancelSignal)))
      .subscribe();

    // Debounce used to update inline menu position
    merge(
      this.startUpdateInlineMenuPosition$.pipe(debounceTime(150)),
      this.cancelUpdateInlineMenuPosition$,
    )
      .pipe(switchMap((sender) => this.updateInlineMenuPositionAfterRepositionEvent(sender)))
      .subscribe();

    // FadeIn Observable behavior
    merge(this.startInlineMenuFadeIn$.pipe(debounceTime(150)), this.cancelInlineMenuFadeIn$)
      .pipe(switchMap((cancelSignal) => this.triggerInlineMenuFadeIn(!!cancelSignal)))
      .subscribe();
  }

  /**
   * Removes cached page details for a tab
   * based on the passed tabId.
   *
   * @param tabId - Used to reference the page details of a specific tab
   */
  removePageDetails(tabId: number) {
    if (this.pageDetailsForTab[tabId]) {
      this.pageDetailsForTab[tabId].clear();
      delete this.pageDetailsForTab[tabId];
    }

    if (this.portKeyForTab[tabId]) {
      delete this.portKeyForTab[tabId];
    }

    this.generatedPassword = null;
    this.focusedFieldData = null;
  }

  /**
   * Updates the inline menu list's ciphers and sends the updated list to the inline menu list iframe.
   * Queries all ciphers for the given url, and sorts them by last used. Will not update the
   * list of ciphers if the extension is not unlocked.
   *
   * @param updateAllCipherTypes - Identifies credit card and identity cipher types should also be updated
   * @param refocusField - Identifies whether the most recently focused field should be refocused
   */
  async updateOverlayCiphers(updateAllCipherTypes = true, refocusField = false) {
    const authStatus = await firstValueFrom(this.authService.activeAccountStatus$);
    if (authStatus === AuthenticationStatus.Unlocked) {
      this.inlineMenuCiphers = new Map();
      this.updateOverlayCiphers$.next({ updateAllCipherTypes, refocusField });
    }
  }

  /**
   * Handles a throttled update of the inline menu ciphers, acting on the emission of a value from
   * an observable. Will update on the first and last emissions within a 100ms time frame.
   *
   * @param updateAllCipherTypes - Identifies credit card and identity cipher types should also be updated
   * @param refocusField - Identifies whether the most recently focused field should be refocused
   */
  async handleOverlayCiphersUpdate({
    updateAllCipherTypes,
    refocusField,
  }: UpdateOverlayCiphersParams) {
    const currentTab = await BrowserApi.getTabFromCurrentWindowId();

    if (this.focusedFieldData && currentTab?.id !== this.focusedFieldData.tabId) {
      const focusedFieldTab = await BrowserApi.getTab(this.focusedFieldData.tabId);
      this.closeInlineMenu({ tab: focusedFieldTab }, { forceCloseInlineMenu: true });
    }

    if (!currentTab || !currentTab.url?.startsWith("http")) {
      if (updateAllCipherTypes) {
        this.cardAndIdentityCiphers = null;
      }
      return;
    }

    const request = this.fido2ActiveRequestManager.getActiveRequest(currentTab.id);
    if (request) {
      request.subject.next({ type: Fido2ActiveRequestEvents.Refresh });
    }

    this.inlineMenuFido2Credentials.clear();
    this.storeInlineMenuFido2Credentials$.next(currentTab.id);

    const ciphersViews = await this.getCipherViews(currentTab, updateAllCipherTypes);
    for (let cipherIndex = 0; cipherIndex < ciphersViews.length; cipherIndex++) {
      this.inlineMenuCiphers.set(`inline-menu-cipher-${cipherIndex}`, ciphersViews[cipherIndex]);
    }

    await this.updateInlineMenuListCiphers(currentTab);

    if (refocusField) {
      await BrowserApi.tabSendMessage(currentTab, { command: "focusMostRecentlyFocusedField" });
    }
  }

  /**
   * Updates the inline menu list's ciphers and sends the updated list to the inline menu list iframe.
   *
   * @param tab - The current tab
   */
  private async updateInlineMenuListCiphers(tab: chrome.tabs.Tab) {
    this.postMessageToPort(this.inlineMenuListPort, {
      command: "updateAutofillInlineMenuListCiphers",
      ciphers: await this.getInlineMenuCipherData(),
      showInlineMenuAccountCreation: this.shouldShowInlineMenuAccountCreation(),
      showPasskeysLabels: this.showPasskeysLabelsWithinInlineMenu,
      focusedFieldHasValue: await this.checkFocusedFieldHasValue(tab),
    });
  }

  /**
   * Gets the decrypted ciphers within a user's vault based on the current tab's URL.
   *
   * @param currentTab - The current tab
   * @param updateAllCipherTypes - Identifies credit card and identity cipher types should also be updated
   */
  private async getCipherViews(
    currentTab: chrome.tabs.Tab,
    updateAllCipherTypes: boolean,
  ): Promise<CipherView[]> {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (!activeUserId) {
      return [];
    }

    if (updateAllCipherTypes || !this.cardAndIdentityCiphers) {
      return this.getAllCipherTypeViews(currentTab, activeUserId);
    }

    const cipherViews = (
      await this.cipherService.getAllDecryptedForUrl(currentTab.url || "", activeUserId)
    ).sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));

    return this.cardAndIdentityCiphers
      ? cipherViews.concat(...this.cardAndIdentityCiphers)
      : cipherViews;
  }

  /**
   * Queries all cipher types from the user's vault returns them sorted by last used.
   *
   * @param currentTab - The current tab
   * @param userId - The active user id
   */
  private async getAllCipherTypeViews(
    currentTab: chrome.tabs.Tab,
    userId: UserId,
  ): Promise<CipherView[]> {
    if (!this.cardAndIdentityCiphers) {
      this.cardAndIdentityCiphers = new Set([]);
    }

    this.cardAndIdentityCiphers.clear();
    const cipherViews = (
      await this.cipherService.getAllDecryptedForUrl(currentTab.url || "", userId, [
        CipherType.Card,
        CipherType.Identity,
      ])
    ).sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));

    if (!this.cardAndIdentityCiphers) {
      return cipherViews;
    }

    for (let cipherIndex = 0; cipherIndex < cipherViews.length; cipherIndex++) {
      const cipherView = cipherViews[cipherIndex];
      if (
        !this.cardAndIdentityCiphers.has(cipherView) &&
        ([CipherType.Card, CipherType.Identity] as CipherType[]).includes(cipherView.type)
      ) {
        this.cardAndIdentityCiphers.add(cipherView);
      }
    }

    if (!this.cardAndIdentityCiphers?.size) {
      this.cardAndIdentityCiphers = null;
    }

    return cipherViews;
  }

  /**
   * Strips out unnecessary data from the ciphers and returns an array of
   * objects that contain the cipher data needed for the inline menu list.
   */
  private async getInlineMenuCipherData(): Promise<InlineMenuCipherData[]> {
    const showFavicons = await firstValueFrom(this.domainSettingsService.showFavicons$);
    const inlineMenuCiphersArray = Array.from(this.inlineMenuCiphers);
    let inlineMenuCipherData: InlineMenuCipherData[];
    this.showPasskeysLabelsWithinInlineMenu = false;

    if (this.shouldShowInlineMenuAccountCreation()) {
      inlineMenuCipherData = await this.buildInlineMenuAccountCreationCiphers(
        inlineMenuCiphersArray,
        true,
      );
    } else {
      inlineMenuCipherData = await this.buildInlineMenuCiphers(
        inlineMenuCiphersArray,
        showFavicons,
      );
    }

    this.currentInlineMenuCiphersCount = inlineMenuCipherData.length;
    return inlineMenuCipherData;
  }

  /**
   * Builds the inline menu ciphers for a form field that is meant for account creation.
   *
   * @param inlineMenuCiphersArray - Array of inline menu ciphers
   * @param showFavicons - Identifies whether favicons should be shown
   */
  private async buildInlineMenuAccountCreationCiphers(
    inlineMenuCiphersArray: [string, CipherView][],
    showFavicons: boolean,
  ) {
    const inlineMenuCipherData: InlineMenuCipherData[] = [];
    const accountCreationLoginCiphers: InlineMenuCipherData[] = [];

    for (let cipherIndex = 0; cipherIndex < inlineMenuCiphersArray.length; cipherIndex++) {
      const [inlineMenuCipherId, cipher] = inlineMenuCiphersArray[cipherIndex];

      if (cipher.type === CipherType.Login) {
        accountCreationLoginCiphers.push(
          await this.buildCipherData({
            inlineMenuCipherId,
            cipher,
            showFavicons,
            showInlineMenuAccountCreation: true,
          }),
        );
        continue;
      }

      if (cipher.type !== CipherType.Identity || !this.focusedFieldData?.accountCreationFieldType) {
        continue;
      }

      const identity = this.getIdentityCipherData(cipher, true);
      if (!identity?.username) {
        continue;
      }

      inlineMenuCipherData.push(
        await this.buildCipherData({
          inlineMenuCipherId,
          cipher,
          showFavicons,
          showInlineMenuAccountCreation: true,
          identityData: identity,
        }),
      );
    }

    if (accountCreationLoginCiphers.length) {
      return inlineMenuCipherData.concat(accountCreationLoginCiphers);
    }

    return inlineMenuCipherData;
  }

  /**
   * Builds the inline menu ciphers for a form field that is not meant for account creation.
   *
   * @param inlineMenuCiphersArray - Array of inline menu ciphers
   * @param showFavicons - Identifies whether favicons should be shown
   */
  private async buildInlineMenuCiphers(
    inlineMenuCiphersArray: [string, CipherView][],
    showFavicons: boolean,
  ) {
    const inlineMenuCipherData: InlineMenuCipherData[] = [];
    const passkeyCipherData: InlineMenuCipherData[] = [];
    const domainExclusions = await this.getExcludedDomains();
    let domainExclusionsSet: Set<string> | null = null;
    if (domainExclusions) {
      domainExclusionsSet = new Set(Object.keys(await this.getExcludedDomains()));
    }
    const passkeysEnabled = await firstValueFrom(this.vaultSettingsService.enablePasskeys$);

    for (let cipherIndex = 0; cipherIndex < inlineMenuCiphersArray.length; cipherIndex++) {
      const [inlineMenuCipherId, cipher] = inlineMenuCiphersArray[cipherIndex];

      switch (cipher.type) {
        case CipherType.Card:
          if (areKeyValuesNull(cipher.card)) {
            continue;
          }
          break;

        case CipherType.Identity:
          if (areKeyValuesNull(cipher.identity)) {
            continue;
          }
          break;

        case CipherType.Login:
          if (
            areKeyValuesNull(cipher.login, ["username", "password", "totp", "fido2Credentials"])
          ) {
            continue;
          }
          break;
      }
      if (!this.focusedFieldMatchesFillType(cipher.type)) {
        continue;
      }

      if (!passkeysEnabled || !(await this.showCipherAsPasskey(cipher, domainExclusionsSet))) {
        inlineMenuCipherData.push(
          await this.buildCipherData({ inlineMenuCipherId, cipher, showFavicons }),
        );
        continue;
      }

      passkeyCipherData.push(
        await this.buildCipherData({
          inlineMenuCipherId,
          cipher,
          showFavicons,
          hasPasskey: true,
        }),
      );

      if (cipher.login?.password && cipher.login.username) {
        inlineMenuCipherData.push(
          await this.buildCipherData({ inlineMenuCipherId, cipher, showFavicons }),
        );
      }
    }

    if (passkeyCipherData.length) {
      this.showPasskeysLabelsWithinInlineMenu =
        passkeyCipherData.length > 0 && inlineMenuCipherData.length > 0;
      return passkeyCipherData.concat(inlineMenuCipherData);
    }

    return inlineMenuCipherData;
  }

  /**
   * Identifies whether we should show the cipher as a passkey in the inline menu list.
   *
   * @param cipher - The cipher to check
   * @param domainExclusions - The domain exclusions to check against
   */
  private async showCipherAsPasskey(
    cipher: CipherView,
    domainExclusions: Set<string> | null,
  ): Promise<boolean> {
    if (cipher.type !== CipherType.Login || !this.focusedFieldData?.showPasskeys) {
      return false;
    }

    const fido2Credentials = cipher.login.fido2Credentials;
    if (!fido2Credentials?.length) {
      return false;
    }

    const credentialId = fido2Credentials[0].credentialId;
    const rpId = fido2Credentials[0].rpId;
    const parsedRpId = parse(rpId, { allowPrivateDomains: true });
    if (domainExclusions?.has(parsedRpId.domain)) {
      return false;
    }

    return this.inlineMenuFido2Credentials.has(credentialId);
  }

  /**
   * When focused field data contains account creation field type of totp
   * and there are totp fields in the current frame for page details return true
   *
   * @returns boolean
   */
  private isTotpFieldForCurrentField(): boolean {
    if (!this.focusedFieldData) {
      return false;
    }
    const totpFields = this.getTotpFields();
    if (!totpFields) {
      return false;
    }
    return (
      totpFields.length > 0 &&
      this.focusedFieldData?.accountCreationFieldType === InlineMenuAccountCreationFieldType.Totp
    );
  }

  /**
   * Builds the cipher data for the inline menu list.
   *
   * @param inlineMenuCipherId - The ID of the inline menu cipher
   * @param cipher - The cipher to build data for
   * @param showFavicons - Identifies whether favicons should be shown
   * @param showInlineMenuAccountCreation - Identifies whether the inline menu is for account creation
   * @param hasPasskey - Identifies whether the cipher has a FIDO2 credential
   * @param identityData - Pre-created identity data
   */
  private async buildCipherData({
    inlineMenuCipherId,
    cipher,
    showFavicons,
    showInlineMenuAccountCreation,
    hasPasskey,
    identityData,
  }: BuildCipherDataParams): Promise<InlineMenuCipherData> {
    const inlineMenuData: InlineMenuCipherData = {
      id: inlineMenuCipherId,
      name: cipher.name,
      type: cipher.type,
      reprompt: cipher.reprompt,
      favorite: cipher.favorite,
      icon: buildCipherIcon(this.iconsServerUrl, cipher, showFavicons),
      accountCreationFieldType: this.focusedFieldData?.accountCreationFieldType,
    };

    if (cipher.type === CipherType.Login) {
      const totpResponse = cipher.login?.totp
        ? await firstValueFrom(this.totpService.getCode$(cipher.login.totp))
        : undefined;

      inlineMenuData.login = {
        username: cipher.login.username,
        totp: totpResponse?.code,
        totpField: this.isTotpFieldForCurrentField(),
        totpCodeTimeInterval: totpResponse?.period,
        passkey: hasPasskey
          ? {
              rpName: cipher.login.fido2Credentials[0].rpName,
              userName: cipher.login.fido2Credentials[0].userName,
            }
          : null,
      };
      return inlineMenuData;
    }

    if (cipher.type === CipherType.Card) {
      inlineMenuData.card = cipher.card.subTitle;
      return inlineMenuData;
    }

    inlineMenuData.identity =
      identityData || this.getIdentityCipherData(cipher, showInlineMenuAccountCreation);
    return inlineMenuData;
  }

  /**
   * Gets the identity data for a cipher based on whether the inline menu is for account creation.
   *
   * @param cipher - The cipher to get the identity data for
   * @param showInlineMenuAccountCreation - Identifies whether the inline menu is for account creation
   */
  private getIdentityCipherData(
    cipher: CipherView,
    showInlineMenuAccountCreation: boolean = false,
  ): { fullName: string; username?: string } {
    const { firstName, lastName } = cipher.identity;

    let fullName = "";
    if (firstName) {
      fullName += firstName;
    }

    if (lastName) {
      fullName += ` ${lastName}`;
      fullName = fullName.trim();
    }

    if (
      !showInlineMenuAccountCreation ||
      !this.focusedFieldData?.accountCreationFieldType ||
      this.focusedFieldMatchesAccountCreationType(InlineMenuAccountCreationFieldType.Password)
    ) {
      return { fullName };
    }

    return {
      fullName,
      username: this.focusedFieldMatchesAccountCreationType(
        InlineMenuAccountCreationFieldType.Email,
      )
        ? cipher.identity.email
        : cipher.identity.username,
    };
  }

  /**
   * Validates whether the currently focused field has an account
   * creation field type that matches the provided field type.
   *
   * @param fieldType - The field type to validate against
   */
  private focusedFieldMatchesAccountCreationType(fieldType: InlineMenuAccountCreationFieldTypes) {
    return this.focusedFieldData?.accountCreationFieldType === fieldType;
  }

  /**
   * Validates whether the most recently focused field has a fill
   * type value that matches the provided fill type.
   *
   * @param fillType - The fill type to validate against
   * @param focusedFieldData - Optional focused field data to validate against
   */
  private focusedFieldMatchesFillType(
    fillType: InlineMenuFillType,
    focusedFieldData?: FocusedFieldData,
  ) {
    const focusedFieldFillType = focusedFieldData
      ? focusedFieldData.inlineMenuFillType
      : this.focusedFieldData?.inlineMenuFillType;

    // When updating the current password for a field, it should fill with a login cipher
    if (
      focusedFieldFillType === InlineMenuFillTypes.CurrentPasswordUpdate &&
      fillType === CipherType.Login
    ) {
      return true;
    }

    return focusedFieldFillType === fillType;
  }

  /**
   * Identifies whether the inline menu is being shown on an account creation field.
   */
  private shouldShowInlineMenuAccountCreation(): boolean {
    if (this.focusedFieldMatchesFillType(InlineMenuFillTypes.AccountCreationUsername)) {
      return true;
    }

    if (!this.focusedFieldMatchesFillType(CipherType.Login)) {
      return false;
    }

    if (this.cardAndIdentityCiphers) {
      return this.inlineMenuCiphers.size === this.cardAndIdentityCiphers.size;
    }

    return this.inlineMenuCiphers.size === 0;
  }

  /**
   * Stores the credential ids associated with a FIDO2 conditional mediated ui request.
   *
   * @param credentials - The FIDO2 credentials to store
   */
  private storeInlineMenuFido2Credentials(credentials: Fido2CredentialView[]) {
    this.inlineMenuFido2Credentials.clear();

    credentials.forEach(
      (credential) =>
        credential?.credentialId && this.inlineMenuFido2Credentials.add(credential.credentialId),
    );
  }

  /**
   * Gets the passkey credentials available from an active FIDO2 request for a given tab.
   *
   * @param tabId - The tab id to get the active request for.
   */
  private availablePasskeyAuthCredentials$(tabId: number): Observable<Fido2CredentialView[]> {
    return this.fido2ActiveRequestManager
      .getActiveRequest$(tabId)
      .pipe(map((request) => request?.credentials ?? []));
  }

  /**
   * Aborts an active FIDO2 request for a given tab and updates the inline menu ciphers.
   *
   * @param tabId - The id of the tab to abort the request for
   */
  private async abortFido2ActiveRequest(tabId: number) {
    this.fido2ActiveRequestManager.removeActiveRequest(tabId);
    await this.updateOverlayCiphers(false);
  }

  /**
   * Gets the neverDomains setting from the domain settings service.
   */
  async getExcludedDomains(): Promise<NeverDomains> {
    return await firstValueFrom(this.domainSettingsService.neverDomains$);
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

    if (pageDetails.frameId !== 0 && pageDetails.details.fields.length) {
      this.buildSubFrameOffsets(
        pageDetails.tab,
        pageDetails.frameId,
        pageDetails.details.url,
      ).catch((error) => this.logService.error(error));
      BrowserApi.tabSendMessage(pageDetails.tab, {
        command: "setupRebuildSubFrameOffsetsListeners",
      }).catch((error) => this.logService.error(error));
    }

    const pageDetailsMap = this.pageDetailsForTab[sender.tab.id];
    if (!pageDetailsMap) {
      this.pageDetailsForTab[sender.tab.id] = new Map([[sender.frameId, pageDetails]]);
      return;
    }

    pageDetailsMap.set(sender.frameId, pageDetails);
  }

  /**
   * Returns the frameId, called when calculating sub frame offsets within the tab.
   * Is used to determine if we should reposition the inline menu when a resize event
   * occurs within a frame.
   *
   * @param sender - The sender of the message
   */
  private getSenderFrameId(sender: chrome.runtime.MessageSender) {
    return sender.frameId;
  }

  /**
   * Handles sub frame offset calculations for the given tab and frame id.
   * Is used in setting the position of the inline menu list and button.
   *
   * @param message - The message received from the `updateSubFrameData` command
   * @param sender - The sender of the message
   */
  private updateSubFrameData(
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[sender.tab.id];
    if (subFrameOffsetsForTab) {
      subFrameOffsetsForTab.set(message.subFrameData.frameId, message.subFrameData);
    }
  }

  /**
   * Builds the offset data for a sub frame of a tab. The offset data is used
   * to calculate the position of the inline menu list and button.
   *
   * @param tab - The tab that the sub frame is associated with
   * @param frameId - The frame ID of the sub frame
   * @param url - The URL of the sub frame
   * @param forceRebuild - Identifies whether the sub frame offsets should be rebuilt
   */
  private async buildSubFrameOffsets(
    tab: chrome.tabs.Tab,
    frameId: number,
    url: string,
    forceRebuild: boolean = false,
  ) {
    let subFrameDepth = 0;
    const tabId = tab.id;
    let subFrameOffsetsForTab = this.subFrameOffsetsForTab[tabId];
    if (!subFrameOffsetsForTab) {
      this.subFrameOffsetsForTab[tabId] = new Map();
      subFrameOffsetsForTab = this.subFrameOffsetsForTab[tabId];
    }

    if (!forceRebuild && subFrameOffsetsForTab.get(frameId)) {
      return;
    }

    const subFrameData: SubFrameOffsetData = { url, top: 0, left: 0, parentFrameIds: [0] };
    let frameDetails = await BrowserApi.getFrameDetails({ tabId, frameId });

    while (frameDetails && frameDetails.parentFrameId > -1) {
      subFrameDepth++;
      if (subFrameDepth >= MAX_SUB_FRAME_DEPTH) {
        subFrameOffsetsForTab.set(frameId, null);
        this.triggerDestroyInlineMenuListeners(tab, frameId);
        return;
      }

      const subFrameOffset: SubFrameOffsetData = await BrowserApi.tabSendMessage(
        tab,
        {
          command: "getSubFrameOffsets",
          subFrameUrl: frameDetails.url,
          subFrameId: frameDetails.documentId,
        },
        { frameId: frameDetails.parentFrameId },
      );

      if (!subFrameOffset) {
        subFrameOffsetsForTab.set(frameId, null);
        BrowserApi.tabSendMessage(
          tab,
          { command: "getSubFrameOffsetsFromWindowMessage", subFrameId: frameId },
          { frameId },
        ).catch((error) => this.logService.error(error));
        return;
      }

      subFrameData.top += subFrameOffset.top;
      subFrameData.left += subFrameOffset.left;
      if (!subFrameData.parentFrameIds.includes(frameDetails.parentFrameId)) {
        subFrameData.parentFrameIds.push(frameDetails.parentFrameId);
      }

      frameDetails = await BrowserApi.getFrameDetails({
        tabId,
        frameId: frameDetails.parentFrameId,
      });
    }

    subFrameOffsetsForTab.set(frameId, subFrameData);
  }

  /**
   * Triggers a removal and destruction of all
   *
   * @param tab - The tab that the sub frame is associated with
   * @param frameId - The frame ID of the sub frame
   */
  private triggerDestroyInlineMenuListeners(tab: chrome.tabs.Tab, frameId: number) {
    this.logService.error(
      "Excessive frame depth encountered, destroying inline menu on field within frame",
      tab,
      frameId,
    );

    BrowserApi.tabSendMessage(
      tab,
      { command: "destroyAutofillInlineMenuListeners" },
      { frameId },
    ).catch((error) => this.logService.error(error));
  }

  /**
   * Rebuilds the sub frame offsets for the tab associated with the sender.
   *
   * @param sender - The sender of the message
   */
  private async rebuildSubFrameOffsets(sender: chrome.runtime.MessageSender) {
    this.cancelUpdateInlineMenuPosition$.next();
    this.cancelInlineMenuDelayedClose$.next(true);

    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[sender.tab.id];
    if (subFrameOffsetsForTab) {
      const tabFrameIds = Array.from(subFrameOffsetsForTab.keys());
      for (const frameId of tabFrameIds) {
        await this.buildSubFrameOffsets(sender.tab, frameId, sender.url, true);
      }
    }
  }

  /**
   * Handles updating the inline menu's position after rebuilding the sub frames
   * for the provided tab. Will skip repositioning the inline menu if the field
   * is not currently focused, or if the focused field has a value.
   *
   * @param sender - The sender of the message
   */
  private async updateInlineMenuPositionAfterRepositionEvent(
    sender: chrome.runtime.MessageSender | void,
  ) {
    if (!sender || !this.isFieldCurrentlyFocused) {
      return;
    }

    if (!this.checkIsInlineMenuButtonVisible()) {
      this.toggleInlineMenuHidden(
        { isInlineMenuHidden: false, setTransparentInlineMenu: true },
        sender,
      ).catch((error) => this.logService.error(error));
    }

    this.updateInlineMenuPosition(sender, AutofillOverlayElement.Button).catch((error) =>
      this.logService.error(error),
    );

    if (
      !this.inlineMenuListPort &&
      (await this.getInlineMenuVisibility()) === AutofillOverlayVisibility.OnButtonClick
    ) {
      return;
    }

    if (
      (await this.checkFocusedFieldHasValue(sender.tab)) &&
      (this.checkIsInlineMenuCiphersPopulated(sender) ||
        (await this.getAuthStatus()) !== AuthenticationStatus.Unlocked)
    ) {
      return;
    }

    this.updateInlineMenuPosition(sender, AutofillOverlayElement.List).catch((error) =>
      this.logService.error(error),
    );
  }

  /**
   * Indicates whether the most recently focused field contains a value.
   *
   * @param tab - The tab to check the focused field for
   */
  private async checkFocusedFieldHasValue(tab: chrome.tabs.Tab) {
    return !!(await BrowserApi.tabSendMessage(
      tab,
      { command: "checkMostRecentlyFocusedFieldHasValue" },
      { frameId: this.focusedFieldData?.frameId || 0 },
    ));
  }

  /**
   * Triggers autofill for the selected cipher in the inline menu list. Also places
   * the selected cipher at the top of the list of ciphers.
   *
   * @param inlineMenuCipherId - Cipher ID corresponding to the inlineMenuCiphers map. Does not correspond to the actual cipher's ID.
   * @param usePasskey - Identifies whether the cipher has a FIDO2 credential
   * @param sender - The sender of the port message
   */
  private async fillInlineMenuCipher(
    { inlineMenuCipherId, usePasskey }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    const pageDetailsForTab = this.pageDetailsForTab[sender.tab.id];
    if (!inlineMenuCipherId || !pageDetailsForTab?.size) {
      return;
    }

    const cipher = this.inlineMenuCiphers.get(inlineMenuCipherId);
    if (usePasskey && cipher.login?.hasFido2Credentials) {
      await this.authenticatePasskeyCredential(
        sender,
        cipher.login.fido2Credentials[0].credentialId,
      );
      this.updateLastUsedInlineMenuCipher(inlineMenuCipherId, cipher);

      if (cipher.login?.totp) {
        const totpResponse = await firstValueFrom(this.totpService.getCode$(cipher.login.totp));

        if (totpResponse?.code) {
          this.platformUtilsService.copyToClipboard(totpResponse.code);
        } else {
          this.logService.error("Failed to get TOTP code for inline menu cipher");
        }
      }
      return;
    }

    if (await this.autofillService.isPasswordRepromptRequired(cipher, sender.tab)) {
      return;
    }

    let pageDetails = Array.from(pageDetailsForTab.values());
    if (this.focusedFieldMatchesFillType(InlineMenuFillTypes.CurrentPasswordUpdate)) {
      pageDetails = this.getFilteredPageDetails(
        pageDetails,
        this.inlineMenuFieldQualificationService.isUpdateCurrentPasswordField,
      );
    }

    const totpCode = await this.autofillService.doAutoFill({
      tab: sender.tab,
      cipher,
      pageDetails,
      fillNewPassword: true,
      allowTotpAutofill: true,
    });

    if (totpCode) {
      this.platformUtilsService.copyToClipboard(totpCode);
    }

    this.updateLastUsedInlineMenuCipher(inlineMenuCipherId, cipher);
  }

  /**
   * Filters the passed page details in order to selectively fill elements based
   * on the provided callback.
   *
   * @param pageDetails - The page details to filter
   * @param fieldsFilter - The callback to filter the fields
   */
  private getFilteredPageDetails(
    pageDetails: PageDetail[],
    fieldsFilter: (field: AutofillField) => boolean,
  ): PageDetail[] {
    let filteredPageDetails: PageDetail[] = structuredClone(pageDetails);
    if (!filteredPageDetails?.length) {
      return [];
    }

    filteredPageDetails = filteredPageDetails.map((pageDetail) => {
      pageDetail.details.fields = pageDetail.details.fields.filter(fieldsFilter);
      return pageDetail;
    });

    return filteredPageDetails;
  }

  /**
   * Triggers a FIDO2 authentication from the inline menu using the passed credential ID.
   *
   * @param sender - The sender of the port message
   * @param credentialId - The credential ID to authenticate
   */
  async authenticatePasskeyCredential(sender: chrome.runtime.MessageSender, credentialId: string) {
    const request = this.fido2ActiveRequestManager.getActiveRequest(sender.tab.id);
    if (!request) {
      this.logService.error(
        "Could not complete passkey autofill due to missing active Fido2 request",
      );
      return;
    }

    chrome.webRequest.onCompleted.addListener(this.handlePasskeyAuthenticationOnCompleted, {
      urls: generateDomainMatchPatterns(sender.tab.url),
    });
    request.subject.next({ type: Fido2ActiveRequestEvents.Continue, credentialId });
  }

  /**
   * Handles the next web request that occurs after a passkey authentication has been completed.
   * Ensures that the inline menu closes after the request, and that the FIDO2 request is aborted
   * if the request is not successful.
   *
   * @param details - The web request details
   */
  private handlePasskeyAuthenticationOnCompleted = (
    details: chrome.webRequest.WebResponseCacheDetails,
  ) => {
    chrome.webRequest.onCompleted.removeListener(this.handlePasskeyAuthenticationOnCompleted);

    if (isInvalidResponseStatusCode(details.statusCode)) {
      this.closeInlineMenu({ tab: { id: details.tabId } } as chrome.runtime.MessageSender, {
        forceCloseInlineMenu: true,
      });
      this.abortFido2ActiveRequest(details.tabId).catch((error) => this.logService.error(error));
      return;
    }

    globalThis.setTimeout(() => this.triggerDelayedInlineMenuClosure(), 3000);
  };

  /**
   * Sets the most recently used cipher at the top of the list of ciphers.
   *
   * @param inlineMenuCipherId - The ID of the inline menu cipher
   * @param cipher - The cipher to set as the most recently used
   */
  private updateLastUsedInlineMenuCipher(inlineMenuCipherId: string, cipher: CipherView) {
    this.inlineMenuCiphers = new Map([[inlineMenuCipherId, cipher], ...this.inlineMenuCiphers]);
  }

  /**
   * Syncs inline menu ordering when a cipher is used from the vault popup.
   * @param cipherId - ID of the cipher that was autofilled from the vault
   */
  async handleVaultAutofillSuggestionUsed(cipherId: string) {
    if (!cipherId || this.inlineMenuCiphers.size === 0) {
      return;
    }

    for (const [inlineMenuCipherId, cipher] of this.inlineMenuCiphers) {
      if (cipher.id === cipherId) {
        this.updateLastUsedInlineMenuCipher(inlineMenuCipherId, cipher);
        const activeUserId = await firstValueFrom(
          this.accountService.activeAccount$.pipe(getOptionalUserId),
        );
        if (activeUserId) {
          await this.cipherService.updateLastUsedDate(cipherId, activeUserId);
        }
        break;
      }
    }
  }

  /**
   * Checks if the inline menu is focused. Will check the inline menu list
   * if it is open, otherwise it will check the inline menu button.
   */
  private checkInlineMenuFocused(sender: chrome.runtime.MessageSender) {
    if (!this.senderTabHasFocusedField(sender)) {
      return;
    }

    if (this.inlineMenuListPort) {
      this.checkInlineMenuListFocused();

      return;
    }

    this.checkInlineMenuButtonFocused(sender);
  }

  /**
   * Posts a message to the inline menu button iframe to check if it is focused.
   *
   * @param sender - The sender of the port message
   */
  private checkInlineMenuButtonFocused(sender: chrome.runtime.MessageSender) {
    if (!this.inlineMenuButtonPort) {
      this.closeInlineMenu(sender, { forceCloseInlineMenu: true });
      return;
    }

    this.postMessageToPort(this.inlineMenuButtonPort, {
      command: "checkAutofillInlineMenuButtonFocused",
    });
  }

  /**
   * Posts a message to the inline menu list iframe to check if it is focused.
   */
  private checkInlineMenuListFocused() {
    this.postMessageToPort(this.inlineMenuListPort, {
      command: "checkAutofillInlineMenuListFocused",
    });
  }

  /**
   * Sends a message to the sender tab to close the autofill inline menu.
   *
   * @param sender - The sender of the port message
   * @param forceCloseInlineMenu - Identifies whether the inline menu should be forced closed
   * @param overlayElement - The overlay element to close, either the list or button
   */
  private closeInlineMenu(
    sender: chrome.runtime.MessageSender,
    { forceCloseInlineMenu, overlayElement }: CloseInlineMenuMessage = {},
  ) {
    const command = "closeAutofillInlineMenu";
    const sendOptions = { frameId: 0 };
    const updateVisibilityDefaults = { overlayElement, isVisible: false, forceUpdate: true };
    this.generatedPassword = null;

    if (forceCloseInlineMenu) {
      BrowserApi.tabSendMessage(sender.tab, { command, overlayElement }, sendOptions).catch(
        (error) => this.logService.error(error),
      );
      this.updateInlineMenuElementIsVisibleStatus(updateVisibilityDefaults, sender);

      return;
    }

    if (this.isFieldCurrentlyFocused) {
      return;
    }

    if (this.isFieldCurrentlyFilling) {
      BrowserApi.tabSendMessage(
        sender.tab,
        { command, overlayElement: AutofillOverlayElement.List },
        sendOptions,
      ).catch((error) => this.logService.error(error));
      this.updateInlineMenuElementIsVisibleStatus(
        Object.assign(updateVisibilityDefaults, { overlayElement: AutofillOverlayElement.List }),
        sender,
      );
      return;
    }

    BrowserApi.tabSendMessage(sender.tab, { command, overlayElement }, sendOptions).catch((error) =>
      this.logService.error(error),
    );
    this.updateInlineMenuElementIsVisibleStatus(updateVisibilityDefaults, sender);
  }

  /**
   * Sends a message to the sender tab to trigger a delayed closure of the inline menu.
   * This is used to ensure that we capture click events on the inline menu in the case
   * that some on page programmatic method attempts to force focus redirection.
   */
  private async triggerDelayedInlineMenuClosure(cancelDelayedClose: boolean = false) {
    if (cancelDelayedClose || this.isFieldCurrentlyFocused) {
      return;
    }

    const message = { command: "triggerDelayedAutofillInlineMenuClosure" };
    this.postMessageToPort(this.inlineMenuButtonPort, message);
    this.postMessageToPort(this.inlineMenuListPort, message);
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
    if (!this.senderTabHasFocusedField(sender)) {
      this.expiredPorts.forEach((port) => port.disconnect());
      this.expiredPorts = [];

      return;
    }

    if (overlayElement === AutofillOverlayElement.Button) {
      this.inlineMenuButtonPort?.disconnect();
      this.inlineMenuButtonPort = null;
      this.inlineMenuButtonMessageConnectorPort?.disconnect();
      this.inlineMenuButtonMessageConnectorPort = null;
      this.isInlineMenuButtonVisible = false;

      return;
    }

    this.inlineMenuListPort?.disconnect();
    this.inlineMenuListPort = null;
    this.inlineMenuListMessageConnectorPort?.disconnect();
    this.inlineMenuListMessageConnectorPort = null;
    this.isInlineMenuListVisible = false;
  }

  /**
   * Get all the totp fields for the tab and frame of the currently focused field
   */
  private getTotpFields(): AutofillField[] {
    const currentTabId = this.focusedFieldData?.tabId;
    const currentFrameId = this.focusedFieldData?.frameId;
    const pageDetailsMap = this.pageDetailsForTab[currentTabId];
    const pageDetails = pageDetailsMap?.get(currentFrameId);

    const fields = pageDetails?.details?.fields || [];
    const totpFields = fields.filter((f) =>
      this.inlineMenuFieldQualificationService.isTotpField(f),
    );

    return totpFields;
  }

  /**
   * calculates the postion and width for multi-input totp field inline menu
   * @param totpFieldArray - the totp fields used to evaluate the position of the menu
   */
  private calculateTotpMultiInputMenuBounds(totpFieldArray: AutofillField[]) {
    // Filter the fields based on the provided totpfields
    const filteredObjects = this.allFieldData.filter((obj) =>
      totpFieldArray.some((o) => o.opid === obj.opid),
    );

    // Return null if no matching objects are found
    if (filteredObjects.length === 0) {
      return null;
    }
    // Calculate the smallest left and largest right values to determine width
    const left = Math.min(
      ...filteredObjects.filter((obj) => rectHasSize(obj.rect)).map((obj) => obj.rect.left),
    );
    const largestRight = Math.max(
      ...filteredObjects.filter((obj) => rectHasSize(obj.rect)).map((obj) => obj.rect.right),
    );

    const width = largestRight - left;

    return { left, width };
  }

  /**
   * calculates the postion for multi-input totp field inline button
   * @param totpFieldArray - the totp fields used to evaluate the position of the menu
   */
  private calculateTotpMultiInputButtonBounds(totpFieldArray: AutofillField[]) {
    const filteredObjects = this.allFieldData.filter((obj) =>
      totpFieldArray.some((o) => o.opid === obj.opid),
    );

    if (filteredObjects.length === 0) {
      return null;
    }

    const maxRight = Math.max(...filteredObjects.map((obj) => obj.rect.right));
    const maxObject = filteredObjects.find((obj) => obj.rect.right === maxRight);
    const top = maxObject.rect.top - maxObject.rect.height * 0.39;
    const left = maxRight - maxObject.rect.height * 0.3;

    return { left, top };
  }

  /**
   * Updates the position of either the inline menu list or button. The position
   * is based on the focused field's position and dimensions.
   *
   * @param sender - The sender of the port message
   * @param overlayElement - The overlay element to update, either the list or button
   */
  private async updateInlineMenuPosition(
    sender: chrome.runtime.MessageSender,
    overlayElement?: string,
  ) {
    if (!overlayElement || !this.senderTabHasFocusedField(sender)) {
      return;
    }

    this.cancelInlineMenuFadeInAndPositionUpdate();

    await BrowserApi.tabSendMessage(
      sender.tab,
      { command: "appendAutofillInlineMenuToDom", overlayElement },
      { frameId: 0 },
    );

    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[this.focusedFieldData?.tabId];
    let subFrameOffsets: SubFrameOffsetData;
    if (subFrameOffsetsForTab) {
      subFrameOffsets = subFrameOffsetsForTab.get(this.focusedFieldData.frameId);
      if (subFrameOffsets === null) {
        this.rebuildSubFrameOffsets$.next(sender);
        this.startUpdateInlineMenuPosition$.next(sender);
        return;
      }
    }

    if (overlayElement === AutofillOverlayElement.Button) {
      this.postMessageToPort(this.inlineMenuButtonPort, {
        command: "updateAutofillInlineMenuPosition",
        styles: this.getInlineMenuButtonPosition(subFrameOffsets),
      });
      this.startInlineMenuFadeIn$.next();

      return;
    }

    this.postMessageToPort(this.inlineMenuListPort, {
      command: "updateAutofillInlineMenuPosition",
      styles: this.getInlineMenuListPosition(subFrameOffsets),
    });
    this.startInlineMenuFadeIn$.next();
  }

  /**
   * Triggers an update of the inline menu's visibility after the top level frame
   * appends the element to the DOM.
   *
   * @param message - The message received from the content script
   * @param sender - The sender of the port message
   */
  private updateInlineMenuElementIsVisibleStatus(
    { overlayElement, isVisible, forceUpdate }: UpdateInlineMenuVisibilityMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (!forceUpdate && !this.senderTabHasFocusedField(sender)) {
      return;
    }

    if (!overlayElement || overlayElement === AutofillOverlayElement.Button) {
      this.isInlineMenuButtonVisible = isVisible;
    }

    if (!overlayElement || overlayElement === AutofillOverlayElement.List) {
      this.isInlineMenuListVisible = isVisible;
    }
  }

  /**
   * Returns the position of the currently open inline menu.
   */
  private getInlineMenuPosition(): InlineMenuPosition {
    return this.inlineMenuPosition;
  }

  /**
   * Posts a message to the inline menu elements to trigger a fade in of the inline menu.
   *
   * @param cancelFadeIn - Signal passed to debounced observable to cancel the fade in
   */
  private async triggerInlineMenuFadeIn(cancelFadeIn: boolean = false) {
    if (cancelFadeIn) {
      return;
    }

    const message = { command: "fadeInAutofillInlineMenuIframe" };
    this.postMessageToPort(this.inlineMenuButtonPort, message);
    this.postMessageToPort(this.inlineMenuListPort, message);
  }

  /**
   * Gets the position of the focused field and calculates the position
   * of the inline menu button based on the focused field's position and dimensions.
   */
  private getInlineMenuButtonPosition(subFrameOffsets: SubFrameOffsetData) {
    const subFrameTopOffset = subFrameOffsets?.top || 0;
    const subFrameLeftOffset = subFrameOffsets?.left || 0;

    const { width, height } = this.focusedFieldData.focusedFieldRects;
    let { top, left } = this.focusedFieldData.focusedFieldRects;
    const { paddingRight, paddingLeft } = this.focusedFieldData.focusedFieldStyles;

    if (this.isTotpFieldForCurrentField()) {
      const totpFields = this.getTotpFields();
      if (totpFields.length > 1) {
        ({ left, top } = this.calculateTotpMultiInputButtonBounds(totpFields));
      }
    }

    let elementOffset = height * 0.37;
    if (height >= 35) {
      elementOffset = height >= 50 ? height * 0.47 : height * 0.42;
    }

    const fieldPaddingRight = parseInt(paddingRight, 10);
    const fieldPaddingLeft = parseInt(paddingLeft, 10);
    const elementHeight = height - elementOffset;

    const elementTopPosition = subFrameTopOffset + top + elementOffset / 2;
    const elementLeftPosition =
      fieldPaddingRight > fieldPaddingLeft
        ? subFrameLeftOffset + left + width - height - (fieldPaddingRight - elementOffset + 2)
        : subFrameLeftOffset + left + width - height + elementOffset / 2;

    this.inlineMenuPosition.button = {
      top: Math.round(elementTopPosition),
      left: Math.round(elementLeftPosition),
      height: Math.round(elementHeight),
      width: Math.round(elementHeight),
    };

    return {
      top: `${this.inlineMenuPosition.button.top}px`,
      left: `${this.inlineMenuPosition.button.left}px`,
      height: `${this.inlineMenuPosition.button.height}px`,
      width: `${this.inlineMenuPosition.button.width}px`,
    };
  }

  /**
   * Gets the position of the focused field and calculates the position
   * of the inline menu list based on the focused field's position and dimensions.
   */
  private getInlineMenuListPosition(subFrameOffsets: SubFrameOffsetData) {
    const subFrameTopOffset = subFrameOffsets?.top || 0;
    const subFrameLeftOffset = subFrameOffsets?.left || 0;

    const { top, height } = this.focusedFieldData.focusedFieldRects;
    let { left, width } = this.focusedFieldData.focusedFieldRects;

    if (this.isTotpFieldForCurrentField()) {
      const totpFields = this.getTotpFields();

      if (totpFields.length > 1) {
        ({ left, width } = this.calculateTotpMultiInputMenuBounds(totpFields));
      }
    }

    this.inlineMenuPosition.list = {
      top: Math.round(top + height + subFrameTopOffset),
      left: Math.round(left + subFrameLeftOffset),
      height: 0,
      width: Math.round(width),
    };

    return {
      width: `${this.inlineMenuPosition.list.width}px`,
      top: `${this.inlineMenuPosition.list.top}px`,
      left: `${this.inlineMenuPosition.list.left}px`,
    };
  }

  /**
   * Sets the focused field data to the data passed in the extension message.
   *
   * @param focusedFieldData - Contains the rects and styles of the focused field.
   * @param sender - The sender of the extension message
   */
  private setFocusedFieldData(
    { focusedFieldData, allFieldsRect }: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (
      this.focusedFieldData &&
      this.senderTabHasFocusedField(sender) &&
      !this.senderFrameHasFocusedField(sender)
    ) {
      BrowserApi.tabSendMessage(
        sender.tab,
        { command: "unsetMostRecentlyFocusedField" },
        { frameId: this.focusedFieldData.frameId },
      ).catch((error) => this.logService.error(error));
    }

    const previousFocusedFieldData = this.focusedFieldData;
    this.focusedFieldData = { ...focusedFieldData, tabId: sender.tab.id, frameId: sender.frameId };
    this.allFieldData = allFieldsRect;
    this.isFieldCurrentlyFocused = true;

    if (this.shouldUpdatePasswordGeneratorMenuOnFieldFocus()) {
      this.updateInlineMenuGeneratedPasswordOnFocus(sender.tab).catch((error) =>
        this.logService.error(error),
      );
      return;
    }

    if (this.shouldUpdateAccountCreationMenuOnFieldFocus(previousFocusedFieldData)) {
      this.updateInlineMenuAccountCreationDataOnFocus(previousFocusedFieldData, sender).catch(
        (error) => this.logService.error(error),
      );
      return;
    }

    if (
      !this.focusedFieldMatchesFillType(
        focusedFieldData?.inlineMenuFillType,
        previousFocusedFieldData,
      ) ||
      // a TOTP field was just focused to - or unfocused from — a non-TOTP field
      // may want to generalize this logic if cipher inline menu types exceed [general cipher, TOTP]
      [focusedFieldData, previousFocusedFieldData].filter(
        (fd) => fd?.accountCreationFieldType === InlineMenuAccountCreationFieldType.Totp,
      ).length === 1
    ) {
      const updateAllCipherTypes = !this.focusedFieldMatchesFillType(
        CipherType.Login,
        focusedFieldData,
      );
      this.updateOverlayCiphers(updateAllCipherTypes).catch((error) =>
        this.logService.error(error),
      );
    }
  }

  /**
   * Identifies if a recently focused field should update as a password generation field.
   */
  private shouldUpdatePasswordGeneratorMenuOnFieldFocus() {
    return (
      this.isInlineMenuButtonVisible &&
      this.focusedFieldMatchesFillType(InlineMenuFillTypes.PasswordGeneration)
    );
  }

  /**
   * Handles updating the inline menu password generator on focus of a field.
   * In the case that the field has a value, will show the save login view.
   *
   * @param tab - The tab that the field is focused within
   */
  private async updateInlineMenuGeneratedPasswordOnFocus(tab: chrome.tabs.Tab) {
    if (await this.shouldShowSaveLoginInlineMenuList(tab)) {
      this.showSaveLoginInlineMenuList();
      return;
    }

    await this.updateGeneratedPassword();
  }

  /**
   * Triggers an update of populated identity ciphers when a login field is focused.
   *
   * @param previousFocusedFieldData - The data set of the previously focused field
   * @param sender - The sender of the extension message
   */
  private async updateInlineMenuAccountCreationDataOnFocus(
    previousFocusedFieldData: FocusedFieldData,
    sender: chrome.runtime.MessageSender,
  ) {
    if (await this.shouldShowSaveLoginInlineMenuList(sender.tab)) {
      this.showSaveLoginInlineMenuList();
      return;
    }

    if (
      !previousFocusedFieldData ||
      !this.isInlineMenuButtonVisible ||
      (await this.getAuthStatus()) !== AuthenticationStatus.Unlocked
    ) {
      return;
    }

    if (
      this.focusedFieldMatchesFillType(CipherType.Login) &&
      this.focusedFieldMatchesAccountCreationType(InlineMenuAccountCreationFieldType.Password)
    ) {
      await this.updateGeneratedPassword();
      return;
    }

    await this.updateInlineMenuListCiphers(sender.tab);
  }

  /**
   * Identifies whether a newly focused field should trigger an update that
   * displays the account creation view within the inline menu.
   *
   * @param previousFocusedFieldData - The data set of the previously focused field
   */
  private shouldUpdateAccountCreationMenuOnFieldFocus(previousFocusedFieldData: FocusedFieldData) {
    const accountCreationFieldBlurred =
      this.focusedFieldMatchesFillType(
        InlineMenuFillTypes.AccountCreationUsername,
        previousFocusedFieldData,
      ) && !this.focusedFieldMatchesFillType(InlineMenuFillTypes.AccountCreationUsername);
    return accountCreationFieldBlurred || this.shouldShowInlineMenuAccountCreation();
  }

  /**
   * Sends a message to the list to show the save login inline menu list view. This view
   * is shown after a field is filled with a generated password.
   */
  private showSaveLoginInlineMenuList() {
    this.postMessageToPort(this.inlineMenuListPort, { command: "showSaveLoginInlineMenuList" });
  }

  /**
   * Generates a password based on the user defined password generation options.
   */
  private async generatePassword(): Promise<void> {
    this.generatedPassword = await this.generatePasswordCallback();
    await this.addPasswordCallback(this.generatedPassword);
  }

  /**
   * Updates the generated password in the inline menu list.
   *
   * @param refreshPassword - Identifies whether the generated password should be refreshed
   */
  private async updateGeneratedPassword(refreshPassword: boolean = false) {
    if (!this.generatedPassword || refreshPassword) {
      await this.generatePassword();
    }

    this.postMessageToPort(this.inlineMenuListPort, {
      command: "updateAutofillInlineMenuGeneratedPassword",
      generatedPassword: this.generatedPassword,
      refreshPassword,
    });
  }

  /**
   * Triggers a fill of the generated password into the current tab. Will trigger
   * a focus of the last focused field after filling the password.
   *
   * @param port - The port of the sender
   */
  private async fillGeneratedPassword(port: chrome.runtime.Port) {
    if (!this.generatedPassword) {
      return;
    }

    const pageDetailsForTab = this.pageDetailsForTab[port.sender.tab.id];
    if (!pageDetailsForTab) {
      return;
    }

    let pageDetails: PageDetail[] = Array.from(pageDetailsForTab.values());
    if (!pageDetails.length) {
      return;
    }

    // If our currently focused field is for a login form, we want to fill the current password field.
    // Otherwise, map over all page details and filter out fields that are not new password fields.
    if (!this.focusedFieldMatchesFillType(CipherType.Login)) {
      pageDetails = this.getFilteredPageDetails(
        pageDetails,
        this.inlineMenuFieldQualificationService.isNewPasswordField,
      );
    }

    const cipher = this.buildLoginCipherView({
      username: "",
      password: this.generatedPassword,
      hostname: "",
      uri: "",
    });

    await this.autofillService.doAutoFill({
      tab: port.sender.tab,
      cipher,
      pageDetails,
      fillNewPassword: true,
      allowTotpAutofill: false,
    });

    globalThis.setTimeout(async () => {
      await BrowserApi.tabSendMessage(
        port.sender.tab,
        {
          command: "generatedPasswordModifyLogin",
        },
        {
          frameId: this.focusedFieldData.frameId || 0,
        },
      );
    }, 300);
  }

  /**
   * Verifies whether the save login inline menu view should be shown. This requires that
   * the login data on the page contains either a current or new password.
   *
   * @param tab - The tab to check for login data
   */
  private async shouldShowSaveLoginInlineMenuList(tab: chrome.tabs.Tab) {
    if (this.focusedFieldData?.tabId !== tab.id) {
      return false;
    }

    const loginData = await this.getInlineMenuFormFieldData(tab);
    if (!loginData) {
      return false;
    }

    return (
      (this.shouldShowInlineMenuAccountCreation() ||
        this.focusedFieldMatchesFillType(InlineMenuFillTypes.PasswordGeneration)) &&
      !!(loginData.password || loginData.newPassword)
    );
  }

  /**
   * Gets the inline menu form field data from the provided tab.
   *
   * @param tab - The tab to get the form field data from
   */
  private async getInlineMenuFormFieldData(
    tab: chrome.tabs.Tab,
  ): Promise<ModifyLoginCipherFormData> {
    return await BrowserApi.tabSendMessage(
      tab,
      {
        command: "getInlineMenuFormFieldData",
        ignoreFieldFocus: true,
      },
      {
        frameId: this.focusedFieldData.frameId || 0,
      },
    );
  }

  /**
   * Updates the inline menu's visibility based on the display property passed in the extension message.
   *
   * @param display - The display property of the inline menu, either "block" or "none"
   * @param sender - The sender of the extension message
   */
  private async toggleInlineMenuHidden(
    { isInlineMenuHidden, setTransparentInlineMenu }: ToggleInlineMenuHiddenMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (!this.senderTabHasFocusedField(sender)) {
      return;
    }

    this.cancelInlineMenuFadeIn$.next(true);
    const display = isInlineMenuHidden ? "none" : "block";
    let styles: { display: string; opacity?: string } = { display };

    if (typeof setTransparentInlineMenu !== "undefined") {
      const opacity = setTransparentInlineMenu ? "0" : "1";
      styles = { ...styles, opacity };
    }

    const portMessage = { command: "toggleAutofillInlineMenuHidden", styles };
    if (this.inlineMenuButtonPort) {
      this.updateInlineMenuElementIsVisibleStatus(
        { overlayElement: AutofillOverlayElement.Button, isVisible: !isInlineMenuHidden },
        sender,
      );
      this.postMessageToPort(this.inlineMenuButtonPort, portMessage);
    }

    if (this.inlineMenuListPort) {
      this.isInlineMenuListVisible = !isInlineMenuHidden;
      this.updateInlineMenuElementIsVisibleStatus(
        { overlayElement: AutofillOverlayElement.List, isVisible: !isInlineMenuHidden },
        sender,
      );
      this.postMessageToPort(this.inlineMenuListPort, portMessage);
    }

    if (setTransparentInlineMenu) {
      this.startInlineMenuFadeIn$.next();
    }
  }

  /**
   * Sends a message to the currently active tab to open the autofill inline menu.
   *
   * @param sender - The sender of the port message
   * @param isOpeningFullInlineMenu - Identifies whether the full inline menu should be forced open regardless of other states
   */
  private async openInlineMenu(
    sender: chrome.runtime.MessageSender,
    isOpeningFullInlineMenu = false,
  ) {
    this.cancelInlineMenuDelayedClose$.next(true);

    if (isOpeningFullInlineMenu) {
      await this.updateInlineMenuPosition(sender, AutofillOverlayElement.Button);
      await this.updateInlineMenuPosition(sender, AutofillOverlayElement.List);
      return;
    }

    if (!(await this.checkFocusedFieldHasValue(sender.tab))) {
      await this.openInlineMenuOnEmptyField(sender);
      return;
    }

    await this.openInlineMenuOnFilledField(sender);
  }

  /**
   * Triggers logic that handles opening the inline menu on an empty form field.
   *
   * @param sender - The sender of the port message
   */
  private async openInlineMenuOnEmptyField(sender: chrome.runtime.MessageSender) {
    if ((await this.getInlineMenuVisibility()) === AutofillOverlayVisibility.OnFieldFocus) {
      await this.updateInlineMenuPosition(sender, AutofillOverlayElement.Button);
      await this.updateInlineMenuPosition(sender, AutofillOverlayElement.List);

      return;
    }

    if (this.inlineMenuListPort) {
      this.closeInlineMenu(sender, {
        forceCloseInlineMenu: true,
        overlayElement: AutofillOverlayElement.List,
      });
    }
    await this.updateInlineMenuPosition(sender, AutofillOverlayElement.Button);
  }

  /**
   * Triggers logic that handles opening the inline menu on a form field that has a value.
   *
   * @param sender - The sender of the port message
   */
  private async openInlineMenuOnFilledField(sender: chrome.runtime.MessageSender) {
    if (await this.shouldShowSaveLoginInlineMenuList(sender.tab)) {
      await this.updateInlineMenuPosition(sender, AutofillOverlayElement.Button);
      await this.updateInlineMenuPosition(sender, AutofillOverlayElement.List);
      return;
    }

    if (this.isInlineMenuListVisible) {
      this.closeInlineMenu(sender, {
        forceCloseInlineMenu: true,
        overlayElement: AutofillOverlayElement.List,
      });
    }
    await this.updateInlineMenuPosition(sender, AutofillOverlayElement.Button);
  }

  /**
   * Gets the inline menu's visibility setting from the settings service.
   */
  private async getInlineMenuVisibility(): Promise<InlineMenuVisibilitySetting> {
    return await firstValueFrom(this.autofillSettingsService.inlineMenuVisibility$);
  }

  /**
   * Gets the inline menu's visibility setting for Cards from the settings service.
   */
  private async getInlineMenuCardsVisibility(): Promise<boolean> {
    return await firstValueFrom(this.autofillSettingsService.showInlineMenuCards$);
  }

  /**
   * Gets the inline menu's visibility setting for Identities from the settings service.
   */
  private async getInlineMenuIdentitiesVisibility(): Promise<boolean> {
    return await firstValueFrom(this.autofillSettingsService.showInlineMenuIdentities$);
  }

  /**
   * Gets the user's authentication status from the auth service.
   */
  private async getAuthStatus() {
    return await firstValueFrom(this.authService.activeAccountStatus$);
  }

  /**
   * Sends a message to the inline menu button to update its authentication status.
   */
  private async updateInlineMenuButtonAuthStatus() {
    this.postMessageToPort(this.inlineMenuButtonPort, {
      command: "updateInlineMenuButtonAuthStatus",
      authStatus: await this.getAuthStatus(),
    });
  }

  /**
   * Handles the inline menu button being clicked. If the user is not authenticated,
   * the vault will be unlocked. If the user is authenticated, the inline menu will
   * be opened.
   *
   * @param port - The port of the inline menu button
   */
  private async handleInlineMenuButtonClicked(port: chrome.runtime.Port) {
    this.cancelInlineMenuDelayedClose$.next(true);
    this.cancelInlineMenuFadeInAndPositionUpdate();

    if ((await this.getAuthStatus()) !== AuthenticationStatus.Unlocked) {
      await this.unlockVault(port);
      return;
    }

    await this.openInlineMenu(port.sender, true);
  }

  /**
   * Facilitates opening the unlock popout window.
   *
   * @param port - The port of the inline menu list
   */
  private async unlockVault(port: chrome.runtime.Port) {
    const { sender } = port;

    this.closeInlineMenu(port.sender, { forceCloseInlineMenu: true });
    const retryMessage: LockedVaultPendingNotificationsData = {
      commandToRetry: { message: { command: "openAutofillInlineMenu" }, sender },
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
   * @param inlineMenuCipherId - Cipher ID corresponding to the inlineMenuCiphers map. Does not correspond to the actual cipher's ID.
   * @param sender - The sender of the port message
   */
  private async viewSelectedCipher(
    { inlineMenuCipherId }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    const cipher = this.inlineMenuCiphers.get(inlineMenuCipherId);
    if (!cipher) {
      return;
    }

    this.closeInlineMenu(sender);

    await this.openViewVaultItemPopout(sender.tab, {
      cipherId: cipher.id,
      action: SHOW_AUTOFILL_BUTTON,
    });
  }

  /**
   * Facilitates redirecting focus to the inline menu list.
   */
  private focusInlineMenuList() {
    this.postMessageToPort(this.inlineMenuListPort, { command: "focusAutofillInlineMenuList" });
  }

  /**
   * Updates the authentication status for the user and opens the inline menu if
   * a followup command is present in the message.
   *
   * @param message - Extension message received from the `unlockCompleted` command
   */
  private async unlockCompleted(message: OverlayBackgroundExtensionMessage) {
    await this.updateInlineMenuButtonAuthStatus();

    const openInlineMenu =
      message.data?.commandToRetry?.message?.command === "openAutofillInlineMenu";
    await this.updateOverlayCiphers(true, openInlineMenu);
  }

  /**
   * Gets the translations for the inline menu page.
   */
  private getInlineMenuTranslations() {
    if (!this.inlineMenuPageTranslations) {
      const translationKeys = [
        "addNewCardItemAria",
        "addNewIdentityItemAria",
        "addNewLoginItemAria",
        "addNewVaultItem",
        "authenticating",
        "cardNumberEndsWith",
        "fillCredentialsFor",
        "fillGeneratedPassword",
        "fillVerificationCode",
        "fillVerificationCodeAria",
        "generatedPassword",
        "lowercaseAriaLabel",
        "logInWithPasskeyAriaLabel",
        "newCard",
        "newIdentity",
        "newItem",
        "newLogin",
        "noItemsToShow",
        "opensInANewWindow",
        "passkeys",
        "passwordRegenerated",
        "passwords",
        "regeneratePassword",
        "saveToBitwarden",
        "toggleBitwardenVaultOverlay",
        "totpCodeAria",
        "totpSecondsSpanAria",
        "unlockAccount",
        "unlockAccountAria",
        "unlockYourAccountToViewAutofillSuggestions",
        "uppercaseAriaLabel",
        "username",
        "view",
        ...Object.values(specialCharacterToKeyMap),
      ];
      this.inlineMenuPageTranslations = translationKeys.reduce(
        (acc: Record<string, string>, key) => {
          acc[key] = this.i18nService.translate(key);
          return acc;
        },
        {},
      );
    }

    return this.inlineMenuPageTranslations;
  }

  /**
   * Facilitates redirecting focus out of one of the
   * inline menu elements to elements on the page.
   *
   * @param direction - The direction to redirect focus to (either "next", "previous" or "current)
   * @param sender - The sender of the port message
   */
  private redirectInlineMenuFocusOut(
    { direction }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    if (!direction) {
      return;
    }

    BrowserApi.tabSendMessageData(sender.tab, "redirectAutofillInlineMenuFocusOut", {
      direction,
    }).catch((error) => this.logService.error(error));
  }

  /**
   * Triggers adding a new vault item from the overlay. Gathers data
   * input by the user before calling to open the add/edit window.
   *
   * @param addNewCipherType - The type of cipher to add
   * @param sender - The sender of the port message
   */
  private getNewVaultItemDetails(
    { addNewCipherType }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    if (!addNewCipherType || !this.senderTabHasFocusedField(sender)) {
      return;
    }

    this.currentAddNewItemData = { addNewCipherType, sender };
    BrowserApi.tabSendMessage(sender.tab, {
      command: "addNewVaultItemFromOverlay",
      addNewCipherType,
    }).catch((error) => this.logService.error(error));
  }

  /**
   * Handles adding a new vault item from the overlay. Gathers data login
   * data captured in the extension message.
   *
   * @param addNewCipherType - The type of cipher to add
   * @param login - The login data captured from the extension message
   * @param card - The card data captured from the extension message
   * @param identity - The identity data captured from the extension message
   * @param sender - The sender of the extension message
   */
  private async addNewVaultItem(
    { addNewCipherType, login, card, identity }: OverlayAddNewItemMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (
      !this.currentAddNewItemData ||
      sender.tab.id !== this.currentAddNewItemData.sender.tab.id ||
      !addNewCipherType ||
      this.currentAddNewItemData.addNewCipherType !== addNewCipherType
    ) {
      return;
    }

    if (login && this.isAddingNewLogin()) {
      this.updateCurrentAddNewItemLogin(login, sender);
    }

    if (card && this.isAddingNewCard()) {
      this.updateCurrentAddNewItemCard(card);
    }

    if (identity && this.isAddingNewIdentity()) {
      this.updateCurrentAddNewItemIdentity(identity);
    }

    this.addNewVaultItem$.next(this.currentAddNewItemData);
  }

  /**
   * Identifies if the current add new item data is for adding a new login.
   */
  private isAddingNewLogin() {
    return this.currentAddNewItemData.addNewCipherType === CipherType.Login;
  }

  /**
   * Identifies if the current add new item data is for adding a new card.
   */
  private isAddingNewCard() {
    return this.currentAddNewItemData.addNewCipherType === CipherType.Card;
  }

  /**
   * Identifies if the current add new item data is for adding a new identity.
   */
  private isAddingNewIdentity() {
    return this.currentAddNewItemData.addNewCipherType === CipherType.Identity;
  }

  /**
   * Updates the current add new item data with the provided login data. If the
   * login data is already present, the data will be merged with the existing data.
   *
   * @param login - The login data captured from the extension message
   * @param sender - The sender of the extension message
   */
  private updateCurrentAddNewItemLogin(
    login: NewLoginCipherData,
    sender: chrome.runtime.MessageSender,
  ) {
    const { username, password } = login;

    if (this.partialLoginDataFoundInSubFrame(sender, login)) {
      login.uri = "";
      login.hostname = "";
    }

    if (!this.currentAddNewItemData.login) {
      this.currentAddNewItemData.login = login;
      return;
    }

    const currentLoginData = this.currentAddNewItemData.login;
    if (sender.frameId === 0 && currentLoginData.hostname && !username && !password) {
      login.uri = "";
      login.hostname = "";
    }

    this.currentAddNewItemData.login = {
      uri: login.uri || currentLoginData.uri,
      hostname: login.hostname || currentLoginData.hostname,
      username: username || currentLoginData.username,
      password: password || currentLoginData.password,
    };
  }

  /**
   * Handles verifying if the login data for a tab is separated between various
   * iframe elements. If that is the case, we want to ignore the login uri and
   * domain to ensure the top frame is treated as the primary source of login data.
   *
   * @param sender - The sender of the extension message
   * @param login - The login data captured from the extension message
   */
  private partialLoginDataFoundInSubFrame(
    sender: chrome.runtime.MessageSender,
    login: NewLoginCipherData,
  ) {
    const { frameId } = sender;
    const { username, password } = login;

    return frameId !== 0 && (!username || !password);
  }

  /**
   * Updates the current add new item data with the provided card data. If the
   * card data is already present, the data will be merged with the existing data.
   *
   * @param card - The card data captured from the extension message
   */
  private updateCurrentAddNewItemCard(card: NewCardCipherData) {
    if (!this.currentAddNewItemData.card) {
      this.currentAddNewItemData.card = card;
      return;
    }

    const currentCardData = this.currentAddNewItemData.card;
    this.currentAddNewItemData.card = {
      cardholderName: card.cardholderName || currentCardData.cardholderName,
      number: card.number || currentCardData.number,
      expirationMonth: card.expirationMonth || currentCardData.expirationMonth,
      expirationYear: card.expirationYear || currentCardData.expirationYear,
      expirationDate: card.expirationDate || currentCardData.expirationDate,
      cvv: card.cvv || currentCardData.cvv,
    };
  }

  /**
   * Updates the current add new item data with the provided identity data. If the
   * identity data is already present, the data will be merged with the existing data.
   *
   * @param identity - The identity data captured from the extension message
   */
  private updateCurrentAddNewItemIdentity(identity: NewIdentityCipherData) {
    if (!this.currentAddNewItemData.identity) {
      this.currentAddNewItemData.identity = identity;
      return;
    }

    const currentIdentityData = this.currentAddNewItemData.identity;
    this.currentAddNewItemData.identity = {
      title: identity.title || currentIdentityData.title,
      firstName: identity.firstName || currentIdentityData.firstName,
      middleName: identity.middleName || currentIdentityData.middleName,
      lastName: identity.lastName || currentIdentityData.lastName,
      fullName: identity.fullName || currentIdentityData.fullName,
      address1: identity.address1 || currentIdentityData.address1,
      address2: identity.address2 || currentIdentityData.address2,
      address3: identity.address3 || currentIdentityData.address3,
      city: identity.city || currentIdentityData.city,
      state: identity.state || currentIdentityData.state,
      postalCode: identity.postalCode || currentIdentityData.postalCode,
      country: identity.country || currentIdentityData.country,
      company: identity.company || currentIdentityData.company,
      phone: identity.phone || currentIdentityData.phone,
      email: identity.email || currentIdentityData.email,
      username: identity.username || currentIdentityData.username,
    };
  }

  /**
   * Handles building a new cipher and opening the add/edit vault item popout.
   *
   * @param login - The login data captured from the extension message
   * @param card - The card data captured from the extension message
   * @param identity - The identity data captured from the extension message
   * @param sender - The sender of the extension message
   */
  private async buildCipherAndOpenAddEditVaultItemPopout({
    login,
    card,
    identity,
    sender,
    addNewCipherType,
  }: CurrentAddNewItemData) {
    const cipherView: CipherView = this.buildNewVaultItemCipherView({
      login,
      card,
      identity,
    });

    if (!cipherView) {
      this.currentAddNewItemData = null;
      return;
    }

    try {
      this.closeInlineMenu(sender);
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.setAddEditCipherInfo(
        {
          cipher: cipherView,
          collectionIds: cipherView.collectionIds,
        },
        activeUserId,
      );

      await this.openAddEditVaultItemPopout(sender.tab, {
        cipherId: cipherView.id,
        cipherType: addNewCipherType,
      });
    } catch (error) {
      this.logService.error("Error building cipher and opening add/edit vault item popout", error);
    }

    this.currentAddNewItemData = null;
  }

  /**
   * Builds and returns a new cipher view with the provided vault item data.
   *
   * @param login - The login data captured from the extension message
   * @param card - The card data captured from the extension message
   * @param identity - The identity data captured from the extension message
   */
  private buildNewVaultItemCipherView({ login, card, identity }: OverlayAddNewItemMessage) {
    if (login && this.isAddingNewLogin()) {
      return this.buildLoginCipherView(login);
    }

    if (card && this.isAddingNewCard()) {
      return this.buildCardCipherView(card);
    }

    if (identity && this.isAddingNewIdentity()) {
      return this.buildIdentityCipherView(identity);
    }
  }

  /**
   * Builds a new login cipher view with the provided login data.
   *
   * @param login - The login data captured from the extension message
   */
  private buildLoginCipherView(login: NewLoginCipherData) {
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

    return cipherView;
  }

  /**
   * Builds a new card cipher view with the provided card data.
   *
   * @param card - The card data captured from the extension message
   */
  private buildCardCipherView(card: NewCardCipherData) {
    const cardView = new CardView();
    cardView.cardholderName = card.cardholderName || "";
    cardView.number = card.number || "";
    cardView.code = card.cvv || "";
    cardView.brand = card.number ? CardView.getCardBrandByPatterns(card.number) : "";

    // If there's a combined expiration date value and no individual month or year values,
    // try to parse them from the combined value
    if (card.expirationDate && !card.expirationMonth && !card.expirationYear) {
      const [parsedYear, parsedMonth] = parseYearMonthExpiry(card.expirationDate);

      cardView.expMonth = parsedMonth || "";
      cardView.expYear = parsedYear || "";
    } else {
      cardView.expMonth = card.expirationMonth || "";
      cardView.expYear = card.expirationYear || "";
    }

    const cipherView = new CipherView();
    cipherView.name = "";
    cipherView.folderId = null;
    cipherView.type = CipherType.Card;
    cipherView.card = cardView;

    return cipherView;
  }

  /**
   * Builds a new identity cipher view with the provided identity data.
   *
   * @param identity - The identity data captured from the extension message
   */
  private buildIdentityCipherView(identity: NewIdentityCipherData) {
    const identityView = new IdentityView();
    identityView.title = identity.title || "";
    identityView.firstName = identity.firstName || "";
    identityView.middleName = identity.middleName || "";
    identityView.lastName = identity.lastName || "";
    identityView.address1 = identity.address1 || "";
    identityView.address2 = identity.address2 || "";
    identityView.address3 = identity.address3 || "";
    identityView.city = identity.city || "";
    identityView.state = identity.state || "";
    identityView.postalCode = identity.postalCode || "";
    identityView.country = identity.country || "";
    identityView.company = identity.company || "";
    identityView.phone = identity.phone || "";
    identityView.email = identity.email || "";
    identityView.username = identity.username || "";

    if (identity.fullName && !identityView.firstName && !identityView.lastName) {
      this.buildIdentityNameParts(identity, identityView);
    }

    const cipherView = new CipherView();
    cipherView.name = "";
    cipherView.folderId = null;
    cipherView.type = CipherType.Identity;
    cipherView.identity = identityView;

    return cipherView;
  }

  /**
   * Splits the identity full name into first, middle, and last name parts.
   *
   * @param identity - The identity data captured from the extension message
   * @param identityView - The identity view to update
   */
  private buildIdentityNameParts(identity: NewIdentityCipherData, identityView: IdentityView) {
    const fullNameParts = identity.fullName.split(" ");
    if (fullNameParts.length === 1) {
      identityView.firstName = fullNameParts[0] || "";

      return;
    }

    if (fullNameParts.length === 2) {
      identityView.firstName = fullNameParts[0] || "";
      identityView.lastName = fullNameParts[1] || "";

      return;
    }

    identityView.firstName = fullNameParts[0] || "";
    identityView.middleName = fullNameParts[1] || "";
    identityView.lastName = fullNameParts[2] || "";
  }

  /**
   * Updates the property that identifies if a form field set up for the inline menu is currently focused.
   *
   * @param message - The message received from the web page
   * @param sender - The sender of the port message
   */
  private updateIsFieldCurrentlyFocused(
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (this.focusedFieldData && !this.senderFrameHasFocusedField(sender)) {
      return;
    }

    this.isFieldCurrentlyFocused = message.isFieldCurrentlyFocused;
  }

  /**
   * Allows a content script to check if a form field setup for the inline menu is currently focused.
   */
  private checkIsFieldCurrentlyFocused() {
    return this.isFieldCurrentlyFocused;
  }

  /**
   * Updates the property that identifies if a form field is currently being autofilled.
   *
   * @param message - The message received from the web page
   */
  private updateIsFieldCurrentlyFilling(message: OverlayBackgroundExtensionMessage) {
    this.isFieldCurrentlyFilling = message.isFieldCurrentlyFilling;
  }

  /**
   * Allows a content script to check if a form field is currently being autofilled.
   */
  private checkIsFieldCurrentlyFilling() {
    return this.isFieldCurrentlyFilling;
  }

  /**
   * Returns the visibility status of the inline menu button.
   */
  private checkIsInlineMenuButtonVisible(): boolean {
    return this.isInlineMenuButtonVisible;
  }

  /**
   * Returns the visibility status of the inline menu list.
   */
  private checkIsInlineMenuListVisible(): boolean {
    return this.isInlineMenuListVisible;
  }

  /**
   * Responds to the content script's request to check if the inline menu ciphers are populated.
   * This will return true only if the sender is the focused field's tab and the inline menu
   * ciphers are populated.
   *
   * @param sender - The sender of the message
   */
  private checkIsInlineMenuCiphersPopulated(sender: chrome.runtime.MessageSender) {
    return this.senderTabHasFocusedField(sender) && this.currentInlineMenuCiphersCount > 0;
  }

  /**
   * Triggers an update in the meta "color-scheme" value within the inline menu button.
   * This is done to ensure that the button element has a transparent background, which
   * is accomplished by setting the "color-scheme" meta value of the button iframe to
   * the same value as the page's meta "color-scheme" value.
   */
  private updateInlineMenuButtonColorScheme() {
    this.postMessageToPort(this.inlineMenuButtonPort, {
      command: "updateAutofillInlineMenuColorScheme",
    });
  }

  /**
   * Triggers an update in the inline menu list's height.
   *
   * @param message - Contains the dimensions of the inline menu list
   */
  private updateInlineMenuListHeight(message: OverlayBackgroundExtensionMessage) {
    const parsedHeight = parseInt(message.styles?.height);
    if (this.inlineMenuPosition.list && parsedHeight > 0) {
      this.inlineMenuPosition.list.height = parsedHeight;
    }

    this.postMessageToPort(this.inlineMenuListPort, {
      command: "updateAutofillInlineMenuPosition",
      styles: message.styles,
    });
  }

  /**
   * Handles verifying whether the inline menu should be repositioned. This is used to
   * guard against removing the inline menu when other frames trigger a resize event.
   *
   * @param sender - The sender of the message
   */
  private checkShouldRepositionInlineMenu(sender: chrome.runtime.MessageSender): boolean {
    if (!this.focusedFieldData || !this.senderTabHasFocusedField(sender)) {
      return false;
    }

    if (this.senderFrameHasFocusedField(sender)) {
      return true;
    }

    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[sender.tab.id];
    if (subFrameOffsetsForTab) {
      for (const value of subFrameOffsetsForTab.values()) {
        if (value?.parentFrameIds.includes(sender.frameId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Identifies if the sender tab is the same as the focused field's tab.
   *
   * @param sender - The sender of the message
   */
  private senderTabHasFocusedField(sender: chrome.runtime.MessageSender) {
    return sender.tab.id === this.focusedFieldData?.tabId;
  }

  /**
   * Identifies if the sender frame is the same as the focused field's frame.
   *
   * @param sender - The sender of the message
   */
  private senderFrameHasFocusedField(sender: chrome.runtime.MessageSender) {
    if (!this.focusedFieldData) {
      return false;
    }

    const { tabId, frameId } = this.focusedFieldData;
    return sender.tab.id === tabId && sender.frameId === frameId;
  }

  /**
   * Triggers when a scroll or resize event occurs within a tab. Will reposition the inline menu
   * if the focused field is within the viewport.
   *
   * @param sender - The sender of the message
   */
  private async triggerOverlayReposition(sender: chrome.runtime.MessageSender) {
    if (!this.checkShouldRepositionInlineMenu(sender)) {
      return;
    }

    this.resetFocusedFieldSubFrameOffsets(sender);
    this.cancelInlineMenuFadeInAndPositionUpdate();
    this.toggleInlineMenuHidden({ isInlineMenuHidden: true }, sender).catch((error) =>
      this.logService.error(error),
    );
    this.repositionInlineMenu$.next(sender);
  }

  /**
   * Sets the sub frame offsets for the currently focused field's frame to a null value .
   * This ensures that we can delay presentation of the inline menu after a reposition
   * event if the user clicks on a field before the sub frames can be rebuilt.
   *
   * @param sender
   */
  private resetFocusedFieldSubFrameOffsets(sender: chrome.runtime.MessageSender) {
    if (this.focusedFieldData?.frameId > 0 && this.subFrameOffsetsForTab[sender.tab.id]) {
      this.subFrameOffsetsForTab[sender.tab.id].set(this.focusedFieldData.frameId, null);
    }
  }

  /**
   * Triggers when a focus event occurs within a tab. Will reposition the inline menu
   * if the focused field is within the viewport.
   *
   * @param sender - The sender of the message
   */
  private async triggerSubFrameFocusInRebuild(sender: chrome.runtime.MessageSender) {
    this.cancelInlineMenuFadeInAndPositionUpdate();
    this.resetFocusedFieldSubFrameOffsets(sender);
    this.rebuildSubFrameOffsets$.next(sender);
    this.repositionInlineMenu$.next(sender);
  }

  /**
   * Handles determining if the inline menu should be repositioned or closed, and initiates
   * the process of calculating the new position of the inline menu.
   *
   * @param sender - The sender of the message
   */
  private repositionInlineMenu = async (sender: chrome.runtime.MessageSender) => {
    this.cancelInlineMenuFadeInAndPositionUpdate();
    if (!this.isFieldCurrentlyFocused && !this.isInlineMenuButtonVisible) {
      await this.closeInlineMenuAfterReposition(sender);
      return;
    }

    const isFieldWithinViewport = await BrowserApi.tabSendMessage(
      sender.tab,
      { command: "checkIsMostRecentlyFocusedFieldWithinViewport" },
      { frameId: this.focusedFieldData?.frameId },
    );
    if (!isFieldWithinViewport) {
      await this.closeInlineMenuAfterReposition(sender);
      return;
    }

    if (this.focusedFieldData?.frameId > 0) {
      this.rebuildSubFrameOffsets$.next(sender);
    }

    this.startUpdateInlineMenuPosition$.next(sender);
  };

  /**
   * Triggers a closure of the inline menu during a reposition event.
   *
   * @param sender - The sender of the message
   */
  private async closeInlineMenuAfterReposition(sender: chrome.runtime.MessageSender) {
    await this.toggleInlineMenuHidden(
      { isInlineMenuHidden: false, setTransparentInlineMenu: true },
      sender,
    );
    this.closeInlineMenu(sender, { forceCloseInlineMenu: true });
  }

  /**
   * Cancels the observables that update the position and fade in of the inline menu.
   */
  private cancelInlineMenuFadeInAndPositionUpdate() {
    this.cancelInlineMenuFadeIn$.next(true);
    this.cancelUpdateInlineMenuPosition$.next();
  }

  /**
   * Sets up the extension message listeners for the overlay.
   */
  private setupExtensionListeners() {
    BrowserApi.messageListener("overlay.background", this.handleExtensionMessage);
    BrowserApi.addListener(chrome.webNavigation.onCommitted, this.handleWebNavigationOnCommitted);
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
      return null;
    }

    const messageResponse = handler({ message, sender });
    if (typeof messageResponse === "undefined") {
      return null;
    }

    Promise.resolve(messageResponse)
      .then((response) => sendResponse(response))
      .catch((error) => this.logService.error(error));
    return true;
  };

  /**
   * Handles clearing page details and sub frame offsets when a frame or tab navigation event occurs.
   *
   * @param details - The details of the web navigation event
   */
  private handleWebNavigationOnCommitted = (
    details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
  ) => {
    const { frameId, tabId } = details;
    const subFrames = this.subFrameOffsetsForTab[tabId];
    if (frameId === 0) {
      this.removePageDetails(tabId);
      if (subFrames) {
        subFrames.clear();
        delete this.subFrameOffsetsForTab[tabId];
      }
      return;
    }

    if (subFrames && subFrames.has(frameId)) {
      subFrames.delete(frameId);
    }
  };

  /**
   * Handles the connection of a port to the extension background.
   *
   * @param port - The port that connected to the extension background
   */
  private handlePortOnConnect = async (port: chrome.runtime.Port) => {
    if (!this.validPortConnections.has(port.name)) {
      return;
    }

    this.storeOverlayPort(port);
    port.onMessage.addListener(this.handleOverlayElementPortMessage);

    const isInlineMenuListPort = port.name === AutofillOverlayPort.List;
    const isInlineMenuButtonPort = port.name === AutofillOverlayPort.Button;
    if (!isInlineMenuListPort && !isInlineMenuButtonPort) {
      return;
    }

    if (!this.portKeyForTab[port.sender.tab.id]) {
      this.portKeyForTab[port.sender.tab.id] = generateRandomChars(12);
    }

    port.onDisconnect.addListener(this.handlePortOnDisconnect);

    const authStatus = await this.getAuthStatus();
    const showInlineMenuAccountCreation = this.shouldShowInlineMenuAccountCreation();
    const showInlineMenuPasswordGenerator = await this.shouldInitInlineMenuPasswordGenerator(
      authStatus,
      isInlineMenuListPort,
      showInlineMenuAccountCreation,
    );
    const showSaveLoginMenu =
      (await this.checkFocusedFieldHasValue(port.sender.tab)) &&
      (await this.shouldShowSaveLoginInlineMenuList(port.sender.tab));

    this.postMessageToPort(port, {
      command: `initAutofillInlineMenu${isInlineMenuListPort ? "List" : "Button"}`,
      iframeUrl: chrome.runtime.getURL(
        `overlay/menu-${isInlineMenuListPort ? "list" : "button"}.html`,
      ),
      pageTitle: chrome.i18n.getMessage(
        isInlineMenuListPort ? "bitwardenVault" : "bitwardenOverlayButton",
      ),
      styleSheetUrl: chrome.runtime.getURL(
        `overlay/menu-${isInlineMenuListPort ? "list" : "button"}.css`,
      ),
      theme: await firstValueFrom(this.themeStateService.selectedTheme$),
      translations: this.getInlineMenuTranslations(),
      ciphers: isInlineMenuListPort ? await this.getInlineMenuCipherData() : null,
      portKey: this.portKeyForTab[port.sender.tab.id],
      portName: isInlineMenuListPort
        ? AutofillOverlayPort.ListMessageConnector
        : AutofillOverlayPort.ButtonMessageConnector,
      inlineMenuFillType: this.focusedFieldData?.inlineMenuFillType,
      showPasskeysLabels: this.showPasskeysLabelsWithinInlineMenu,
      generatedPassword: showInlineMenuPasswordGenerator ? this.generatedPassword : null,
      showSaveLoginMenu,
      showInlineMenuAccountCreation,
      authStatus,
    });
    this.updateInlineMenuPosition(
      port.sender,
      isInlineMenuListPort ? AutofillOverlayElement.List : AutofillOverlayElement.Button,
    ).catch((error) => this.logService.error(error));
  };

  /**
   * Wraps the port.postMessage method to handle any errors that may occur.
   *
   * @param port - The port to send the message to
   * @param message - The message to send to the port
   */
  private postMessageToPort = (port: chrome.runtime.Port, message: Record<string, any>) => {
    if (!port) {
      return;
    }

    try {
      port.postMessage(message);
    } catch {
      // Catch when the port.postMessage call triggers an error to ensure login execution continues.
    }
  };

  /**
   * Stores the connected overlay port and sets up any existing ports to be disconnected.
   *
   * @param port - The port to store
   */
  private storeOverlayPort(port: chrome.runtime.Port) {
    if (port.name === AutofillOverlayPort.List) {
      this.storeExpiredOverlayPort(this.inlineMenuListPort);
      this.inlineMenuListPort = port;
      return;
    }

    if (port.name === AutofillOverlayPort.Button) {
      this.storeExpiredOverlayPort(this.inlineMenuButtonPort);
      this.inlineMenuButtonPort = port;
      return;
    }

    if (port.name === AutofillOverlayPort.ButtonMessageConnector) {
      this.storeExpiredOverlayPort(this.inlineMenuButtonMessageConnectorPort);
      this.inlineMenuButtonMessageConnectorPort = port;
      return;
    }

    if (port.name === AutofillOverlayPort.ListMessageConnector) {
      this.storeExpiredOverlayPort(this.inlineMenuListMessageConnectorPort);
      this.inlineMenuListMessageConnectorPort = port;
      return;
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
   * Identifies if the focused field should show the inline menu
   * password generator when the inline menu is opened.
   *
   * @param authStatus - The current authentication status
   * @param isInlineMenuListPort - Identifies if the port is for the inline menu list
   * @param showInlineMenuAccountCreation - Identifies if the inline menu account creation should be shown
   */
  private async shouldInitInlineMenuPasswordGenerator(
    authStatus: AuthenticationStatus,
    isInlineMenuListPort: boolean,
    showInlineMenuAccountCreation: boolean,
  ) {
    if (!isInlineMenuListPort || authStatus !== AuthenticationStatus.Unlocked) {
      return false;
    }

    const focusFieldShouldShowPasswordGenerator =
      this.focusedFieldMatchesFillType(InlineMenuFillTypes.PasswordGeneration) ||
      (showInlineMenuAccountCreation &&
        this.focusedFieldMatchesAccountCreationType(InlineMenuAccountCreationFieldType.Password));
    if (!focusFieldShouldShowPasswordGenerator) {
      return false;
    }

    if (!this.generatedPassword) {
      await this.generatePassword();
    }

    return true;
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
    const tabPortKey = this.portKeyForTab[port.sender.tab.id];
    if (!tabPortKey || tabPortKey !== message?.portKey) {
      return;
    }

    const command = message.command;
    let handler: CallableFunction | undefined;

    if (port.name === AutofillOverlayPort.ButtonMessageConnector) {
      handler = this.inlineMenuButtonPortMessageHandlers[command];
    }

    if (port.name === AutofillOverlayPort.ListMessageConnector) {
      handler = this.inlineMenuListPortMessageHandlers[command];
    }

    if (!handler) {
      return;
    }

    handler({ message, port });
  };

  /**
   * Ensures that the inline menu list and button port
   * references are reset when they are disconnected.
   *
   * @param port - The port that was disconnected
   */
  private handlePortOnDisconnect = (port: chrome.runtime.Port) => {
    const updateVisibilityDefaults = { isVisible: false, forceUpdate: true };

    if (port.name === AutofillOverlayPort.List) {
      this.inlineMenuListPort = null;
      this.inlineMenuListMessageConnectorPort?.disconnect();
      this.inlineMenuListMessageConnectorPort = null;
      this.updateInlineMenuElementIsVisibleStatus(
        Object.assign(updateVisibilityDefaults, { overlayElement: AutofillOverlayElement.List }),
        port.sender,
      );
      this.inlineMenuPosition.list = null;
    }

    if (port.name === AutofillOverlayPort.Button) {
      this.inlineMenuButtonPort = null;
      this.inlineMenuButtonMessageConnectorPort?.disconnect();
      this.inlineMenuButtonMessageConnectorPort = null;
      this.updateInlineMenuElementIsVisibleStatus(
        Object.assign(updateVisibilityDefaults, { overlayElement: AutofillOverlayElement.List }),
        port.sender,
      );
      this.inlineMenuPosition.button = null;
    }
  };
}
