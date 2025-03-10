// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import "@webcomponents/custom-elements";
import "lit/polyfill-support.js";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EVENTS, UPDATE_PASSKEYS_HEADINGS_ON_SCROLL } from "@bitwarden/common/autofill/constants";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../../../../background/abstractions/overlay.background";
import { InlineMenuFillTypes } from "../../../../enums/autofill-overlay.enum";
import { buildSvgDomElement, specialCharacterToKeyMap, throttle } from "../../../../utils";
import {
  creditCardIcon,
  globeIcon,
  idCardIcon,
  lockIcon,
  passkeyIcon,
  plusIcon,
  viewCipherIcon,
  keyIcon,
  refreshIcon,
  spinnerIcon,
} from "../../../../utils/svg-icons";
import {
  AutofillInlineMenuListWindowMessageHandlers,
  InitAutofillInlineMenuListMessage,
  UpdateAutofillInlineMenuGeneratedPasswordMessage,
  UpdateAutofillInlineMenuListCiphersParams,
} from "../../abstractions/autofill-inline-menu-list";
import { AutofillInlineMenuPageElement } from "../shared/autofill-inline-menu-page-element";

export class AutofillInlineMenuList extends AutofillInlineMenuPageElement {
  private inlineMenuListContainer: HTMLDivElement;
  private passwordGeneratorContainer: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private eventHandlersMemo: { [key: string]: EventListener } = {};
  private ciphers: InlineMenuCipherData[] = [];
  private ciphersList: HTMLUListElement;
  private cipherListScrollIsDebounced = false;
  private cipherListScrollDebounceTimeout: number | NodeJS.Timeout;
  private currentCipherIndex = 0;
  private inlineMenuFillType: InlineMenuFillTypes;
  private showInlineMenuAccountCreation: boolean;
  private showPasskeysLabels: boolean;
  private newItemButtonElement: HTMLButtonElement;
  private passkeysHeadingElement: HTMLLIElement;
  private loginHeadingElement: HTMLLIElement;
  private lastPasskeysListItem: HTMLLIElement;
  private passkeysHeadingHeight: number;
  private lastPasskeysListItemHeight: number;
  private ciphersListHeight: number;
  private isPasskeyAuthInProgress = false;
  private authStatus: AuthenticationStatus;
  private readonly showCiphersPerPage = 6;
  private readonly headingBorderClass = "inline-menu-list-heading--bordered";
  private readonly inlineMenuListWindowMessageHandlers: AutofillInlineMenuListWindowMessageHandlers =
    {
      initAutofillInlineMenuList: ({ message }) => this.initAutofillInlineMenuList(message),
      checkAutofillInlineMenuListFocused: () => this.checkInlineMenuListFocused(),
      updateAutofillInlineMenuListCiphers: ({ message }) => this.updateListItems(message),
      updateAutofillInlineMenuGeneratedPassword: ({ message }) =>
        this.handleUpdateAutofillInlineMenuGeneratedPassword(message),
      showSaveLoginInlineMenuList: () => this.handleShowSaveLoginInlineMenuList(),
      focusAutofillInlineMenuList: () => this.focusInlineMenuList(),
    };

  constructor() {
    super();

    this.setupInlineMenuListGlobalListeners();
  }

  /**
   * Initializes the inline menu list and updates the list items with the passed ciphers.
   * If the auth status is not `Unlocked`, the locked inline menu is built.
   *
   * @param message - The message containing the data to initialize the inline menu list.
   */
  private async initAutofillInlineMenuList(message: InitAutofillInlineMenuListMessage) {
    const {
      translations,
      styleSheetUrl,
      theme,
      authStatus,
      ciphers,
      portKey,
      inlineMenuFillType,
      showInlineMenuAccountCreation,
      showPasskeysLabels,
      generatedPassword,
      showSaveLoginMenu,
    } = message;
    const linkElement = await this.initAutofillInlineMenuPage(
      "list",
      styleSheetUrl,
      translations,
      portKey,
    );

    this.authStatus = authStatus;
    this.inlineMenuFillType = inlineMenuFillType;
    this.showPasskeysLabels = showPasskeysLabels;

    const themeClass = `theme_${theme}`;
    globalThis.document.documentElement.classList.add(themeClass);

    this.inlineMenuListContainer = globalThis.document.createElement("div");
    this.inlineMenuListContainer.classList.add("inline-menu-list-container", themeClass);
    this.resizeObserver.observe(this.inlineMenuListContainer);

    this.shadowDom.append(linkElement, this.inlineMenuListContainer);

    if (authStatus !== AuthenticationStatus.Unlocked) {
      this.buildLockedInlineMenu();
      return;
    }

    if (showSaveLoginMenu) {
      this.buildSaveLoginInlineMenuList();
      return;
    }

    if (generatedPassword) {
      this.buildPasswordGenerator(generatedPassword);
      return;
    }

    this.updateListItems({
      ciphers,
      showInlineMenuAccountCreation,
    });
  }

  /**
   * Builds the locked inline menu, which is displayed when the user is not authenticated.
   * Facilitates the ability to unlock the extension from the inline menu.
   */
  private buildLockedInlineMenu() {
    const lockedInlineMenu = globalThis.document.createElement("div");
    lockedInlineMenu.id = "locked-inline-menu-description";
    lockedInlineMenu.classList.add("locked-inline-menu", "inline-menu-list-message");
    lockedInlineMenu.textContent = this.getTranslation(
      "unlockYourAccountToViewAutofillSuggestions",
    );

    const unlockButtonElement = globalThis.document.createElement("button");
    unlockButtonElement.id = "unlock-button";
    unlockButtonElement.tabIndex = -1;
    unlockButtonElement.classList.add(
      "unlock-button",
      "inline-menu-list-button",
      "inline-menu-list-action",
    );
    unlockButtonElement.textContent = this.getTranslation("unlockAccount");
    unlockButtonElement.setAttribute("aria-label", this.getTranslation("unlockAccountAria"));
    unlockButtonElement.prepend(buildSvgDomElement(lockIcon));
    unlockButtonElement.addEventListener(EVENTS.CLICK, this.handleUnlockButtonClick);

    const inlineMenuListButtonContainer = this.buildButtonContainer(unlockButtonElement);

    this.inlineMenuListContainer.append(lockedInlineMenu, inlineMenuListButtonContainer);
  }

  /**
   * Builds the inline menu list as a prompt that asks the user if they'd like to save the login data.
   */
  private buildSaveLoginInlineMenuList() {
    const saveLoginMessage = globalThis.document.createElement("div");
    saveLoginMessage.classList.add("save-login", "inline-menu-list-message");
    saveLoginMessage.textContent = this.getTranslation("saveLoginToBitwarden");

    const newItemButton = this.buildNewItemButton(true);
    this.showInlineMenuAccountCreation = true;

    this.inlineMenuListContainer.append(saveLoginMessage, newItemButton);
  }

  /**
   * Handles the show save login inline menu list message that is triggered from the background script.
   */
  private handleShowSaveLoginInlineMenuList() {
    if (this.authStatus === AuthenticationStatus.Unlocked) {
      this.resetInlineMenuContainer();
      this.buildSaveLoginInlineMenuList();
    }
  }

  /**
   * Handles the click event for the unlock button.
   * Sends a message to the parent window to unlock the vault.
   */
  private handleUnlockButtonClick = () => {
    this.postMessageToParent({ command: "unlockVault" });
  };

  /**
   * Builds the password generator within the inline menu.
   *
   * @param generatedPassword - The generated password to display.
   */
  private buildPasswordGenerator(generatedPassword: string) {
    this.passwordGeneratorContainer = globalThis.document.createElement("div");
    this.passwordGeneratorContainer.classList.add("password-generator-container");

    const passwordGeneratorActions = globalThis.document.createElement("div");
    passwordGeneratorActions.classList.add("password-generator-actions");

    const fillGeneratedPasswordButton = globalThis.document.createElement("button");
    fillGeneratedPasswordButton.tabIndex = -1;
    fillGeneratedPasswordButton.classList.add(
      "fill-generated-password-button",
      "inline-menu-list-action",
    );
    fillGeneratedPasswordButton.setAttribute(
      "aria-label",
      this.getTranslation("fillGeneratedPassword"),
    );

    const passwordGeneratorHeading = globalThis.document.createElement("div");
    passwordGeneratorHeading.classList.add("password-generator-heading");
    passwordGeneratorHeading.textContent = this.getTranslation("fillGeneratedPassword");

    const passwordGeneratorContent = globalThis.document.createElement("div");
    passwordGeneratorContent.id = "password-generator-content";
    passwordGeneratorContent.classList.add("password-generator-content");
    passwordGeneratorContent.append(
      passwordGeneratorHeading,
      this.buildColorizedPasswordElement(generatedPassword),
    );

    fillGeneratedPasswordButton.append(buildSvgDomElement(keyIcon), passwordGeneratorContent);
    fillGeneratedPasswordButton.addEventListener(
      EVENTS.CLICK,
      this.handleFillGeneratedPasswordClick,
    );
    fillGeneratedPasswordButton.addEventListener(
      EVENTS.KEYUP,
      this.handleFillGeneratedPasswordKeyUp,
    );

    const refreshGeneratedPasswordButton = globalThis.document.createElement("button");
    refreshGeneratedPasswordButton.tabIndex = -1;
    refreshGeneratedPasswordButton.classList.add(
      "refresh-generated-password-button",
      "inline-menu-list-action",
    );
    refreshGeneratedPasswordButton.setAttribute(
      "aria-label",
      this.getTranslation("regeneratePassword"),
    );
    refreshGeneratedPasswordButton.appendChild(buildSvgDomElement(refreshIcon));
    refreshGeneratedPasswordButton.addEventListener(
      EVENTS.CLICK,
      this.handleRefreshGeneratedPasswordClick,
    );
    refreshGeneratedPasswordButton.addEventListener(
      EVENTS.KEYUP,
      this.handleRefreshGeneratedPasswordKeyUp,
    );

    passwordGeneratorActions.append(fillGeneratedPasswordButton, refreshGeneratedPasswordButton);

    this.passwordGeneratorContainer.appendChild(passwordGeneratorActions);
    this.inlineMenuListContainer.appendChild(this.passwordGeneratorContainer);
  }

  /**
   * Builds the colorized password content element.
   *
   * @param password - The password to display.
   */
  private buildColorizedPasswordElement(password: string) {
    let ariaDescription = `${this.getTranslation("generatedPassword")}: `;
    const passwordContainer = globalThis.document.createElement("div");
    passwordContainer.classList.add("colorized-password");
    const appendPasswordCharacter = (character: string, type: string) => {
      const characterElement = globalThis.document.createElement("div");
      characterElement.classList.add(`password-${type}`);
      characterElement.textContent = character;

      passwordContainer.appendChild(characterElement);
    };

    const passwordArray = Array.from(password);
    for (let i = 0; i < passwordArray.length; i++) {
      const character = passwordArray[i];

      if (character.match(/\W/)) {
        appendPasswordCharacter(character, "special");
        ariaDescription += `${this.getTranslation(specialCharacterToKeyMap[character])} `;
        continue;
      }

      if (character.match(/\d/)) {
        appendPasswordCharacter(character, "number");
        ariaDescription += `${character} `;
        continue;
      }

      appendPasswordCharacter(character, "letter");
      ariaDescription +=
        character === character.toLowerCase()
          ? `${this.getTranslation("lowercaseAriaLabel")} ${character} `
          : `${this.getTranslation("uppercaseAriaLabel")} ${character} `;
    }

    passwordContainer.setAttribute("aria-label", ariaDescription);
    return passwordContainer;
  }

  /**
   * Handles the click event for the fill generated password button. Triggers
   * a message to the background script to fill the generated password.
   */
  private handleFillGeneratedPasswordClick = () => {
    this.postMessageToParent({ command: "fillGeneratedPassword" });
  };

  /**
   * Handles the keyup event for the fill generated password button.
   *
   * @param event - The keyup event.
   */
  private handleFillGeneratedPasswordKeyUp = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.code === "Space") {
      this.handleFillGeneratedPasswordClick();
      return;
    }

    if (
      event.code === "ArrowRight" &&
      event.target instanceof HTMLElement &&
      event.target.nextElementSibling
    ) {
      (event.target.nextElementSibling as HTMLElement).focus();
      event.target.parentElement.classList.add("remove-outline");
      return;
    }
  };

  /**
   * Handles the click event of the password regenerator button.
   *
   * @param event - The click event.
   */
  private handleRefreshGeneratedPasswordClick = (event?: MouseEvent) => {
    if (event) {
      (event.target as HTMLElement)
        .closest(".password-generator-actions")
        ?.classList.add("remove-outline");
    }

    this.postMessageToParent({ command: "refreshGeneratedPassword" });
  };

  /**
   * Handles the keyup event for the password regenerator button.
   *
   * @param event - The keyup event.
   */
  private handleRefreshGeneratedPasswordKeyUp = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.code === "Space") {
      this.handleRefreshGeneratedPasswordClick();
      return;
    }

    if (
      event.code === "ArrowLeft" &&
      event.target instanceof HTMLElement &&
      event.target.previousElementSibling
    ) {
      (event.target.previousElementSibling as HTMLElement).focus();
      event.target.parentElement.classList.remove("remove-outline");
      return;
    }
  };

  /**
   * Updates the generated password content element with the passed generated password.
   *
   * @param message - The message containing the generated password.
   */
  private handleUpdateAutofillInlineMenuGeneratedPassword(
    message: UpdateAutofillInlineMenuGeneratedPasswordMessage,
  ) {
    if (this.authStatus !== AuthenticationStatus.Unlocked || !message.generatedPassword) {
      return;
    }

    const passwordGeneratorContentElement = this.inlineMenuListContainer.querySelector(
      "#password-generator-content",
    );
    const colorizedPasswordElement =
      passwordGeneratorContentElement?.querySelector(".colorized-password");
    if (!colorizedPasswordElement) {
      this.resetInlineMenuContainer();
      this.buildPasswordGenerator(message.generatedPassword);
      return;
    }

    colorizedPasswordElement.replaceWith(
      this.buildColorizedPasswordElement(message.generatedPassword),
    );
  }

  /**
   * Filters the ciphers to include only TOTP-related ones if the field is a TOTP field.
   * If the field is a TOTP field but no TOTP is present, it returns an empty array.
   *
   * @param ciphers - The list of ciphers to filter.
   * @returns The filtered list of ciphers or an empty list if no valid TOTP ciphers are present.
   */
  private getFilteredCiphersForTotpField(ciphers: InlineMenuCipherData[]): InlineMenuCipherData[] {
    if (!ciphers?.length) {
      return [];
    }

    const isTotpField =
      this.inlineMenuFillType === CipherType.Login &&
      ciphers.some((cipher) => cipher.login?.totpField);

    if (isTotpField) {
      return ciphers.filter((cipher) => cipher.login?.totp);
    }

    return ciphers;
  }

  /**
   * Updates the list items with the passed ciphers.
   * If no ciphers are passed, the no results inline menu is built.
   *
   * @param ciphers - The ciphers to display in the inline menu list.
   * @param showInlineMenuAccountCreation - Whether identity ciphers are shown on login fields.
   */
  private updateListItems({
    ciphers,
    showInlineMenuAccountCreation,
  }: UpdateAutofillInlineMenuListCiphersParams) {
    if (this.isPasskeyAuthInProgress) {
      return;
    }

    this.ciphers = this.getFilteredCiphersForTotpField(ciphers);
    this.currentCipherIndex = 0;
    this.showInlineMenuAccountCreation = showInlineMenuAccountCreation;
    this.resetInlineMenuContainer();

    if (!this.ciphers?.length) {
      this.buildNoResultsInlineMenuList();
      return;
    }

    this.ciphersList = globalThis.document.createElement("ul");
    this.ciphersList.classList.add("inline-menu-list-actions");
    this.ciphersList.setAttribute("role", "list");
    this.setupCipherListScrollListeners();

    this.loadPageOfCiphers();

    this.inlineMenuListContainer.appendChild(this.ciphersList);
    this.toggleScrollClass();

    if (!this.showInlineMenuAccountCreation) {
      return;
    }

    const addNewLoginButtonContainer = this.buildNewItemButton();
    this.inlineMenuListContainer.appendChild(addNewLoginButtonContainer);
    this.inlineMenuListContainer.classList.add("inline-menu-list-container--with-new-item-button");
    this.newItemButtonElement.addEventListener(EVENTS.KEYUP, this.handleNewItemButtonKeyUpEvent);
  }

  /**
   * Clears and resets the inline menu list container.
   */
  private resetInlineMenuContainer() {
    if (this.inlineMenuListContainer) {
      this.inlineMenuListContainer.innerHTML = "";
      this.inlineMenuListContainer.classList.remove(
        "inline-menu-list-container--with-new-item-button",
      );
    }
  }

  /**
   * Inline menu view that is presented when no ciphers are found for a given page.
   * Facilitates the ability to add a new vault item from the inline menu.
   */
  private buildNoResultsInlineMenuList() {
    const noItemsMessage = globalThis.document.createElement("div");
    noItemsMessage.classList.add("no-items", "inline-menu-list-message");
    noItemsMessage.textContent = this.getTranslation("noItemsToShow");

    const newItemButton = this.buildNewItemButton();

    this.inlineMenuListContainer.append(noItemsMessage, newItemButton);
  }

  /**
   * Builds a "New Item" button and returns the container of that button.
   */
  private buildNewItemButton(showLogin = false) {
    this.newItemButtonElement = globalThis.document.createElement("button");
    this.newItemButtonElement.tabIndex = -1;
    this.newItemButtonElement.id = "new-item-button";
    this.newItemButtonElement.classList.add(
      "add-new-item-button",
      "inline-menu-list-button",
      "inline-menu-list-action",
    );
    this.newItemButtonElement.textContent = this.getNewItemButtonText(showLogin);
    this.newItemButtonElement.setAttribute("aria-label", this.getNewItemAriaLabel(showLogin));
    this.newItemButtonElement.prepend(buildSvgDomElement(plusIcon));
    this.newItemButtonElement.addEventListener(EVENTS.CLICK, this.handeNewItemButtonClick);

    return this.buildButtonContainer(this.newItemButtonElement);
  }

  /**
   * Gets the new item text for the button based on the cipher type the focused field is filled by.
   */
  private getNewItemButtonText(showLogin: boolean) {
    if (this.isFilledByLoginCipher() || this.showInlineMenuAccountCreation || showLogin) {
      return this.getTranslation("newLogin");
    }

    if (this.isFilledByCardCipher()) {
      return this.getTranslation("newCard");
    }

    if (this.isFilledByIdentityCipher()) {
      return this.getTranslation("newIdentity");
    }

    return this.getTranslation("newItem");
  }

  /**
   * Gets the aria label for the new item button based on the cipher type the focused field is filled by.
   */
  private getNewItemAriaLabel(showLogin: boolean) {
    if (this.isFilledByLoginCipher() || this.showInlineMenuAccountCreation || showLogin) {
      return this.getTranslation("addNewLoginItemAria");
    }

    if (this.isFilledByCardCipher()) {
      return this.getTranslation("addNewCardItemAria");
    }

    if (this.isFilledByIdentityCipher()) {
      return this.getTranslation("addNewIdentityItemAria");
    }

    return this.getTranslation("addNewVaultItem");
  }

  /**
   * Builds a container for a given element.
   *
   * @param element - The element to build the container for.
   */
  private buildButtonContainer(element: Element) {
    const inlineMenuListButtonContainer = globalThis.document.createElement("div");
    inlineMenuListButtonContainer.classList.add("inline-menu-list-button-container");
    inlineMenuListButtonContainer.appendChild(element);

    return inlineMenuListButtonContainer;
  }

  /**
   * Handles the click event for the new item button.
   * Sends a message to the parent window to add a new vault item.
   */
  private handeNewItemButtonClick = () => {
    let addNewCipherType = this.inlineMenuFillType;

    if (this.showInlineMenuAccountCreation) {
      addNewCipherType = CipherType.Login;
    }

    this.postMessageToParent({
      command: "addNewVaultItem",
      addNewCipherType,
    });
  };

  /**
   * Loads a page of ciphers into the inline menu list container.
   */
  private loadPageOfCiphers() {
    const lastIndex = Math.min(
      this.currentCipherIndex + this.showCiphersPerPage,
      this.ciphers.length,
    );
    for (let cipherIndex = this.currentCipherIndex; cipherIndex < lastIndex; cipherIndex++) {
      this.ciphersList.appendChild(this.buildInlineMenuListActionsItem(this.ciphers[cipherIndex]));
      this.currentCipherIndex++;
    }

    if (!this.showPasskeysLabels && this.allCiphersLoaded()) {
      this.ciphersList.removeEventListener(EVENTS.SCROLL, this.updateCiphersListOnScroll);
    }
  }

  /**
   * Validates whether the list of ciphers has been fully loaded.
   */
  private allCiphersLoaded() {
    return this.currentCipherIndex >= this.ciphers.length;
  }

  /**
   * Sets up the scroll listeners for the ciphers list. These are used to trigger an update of
   * the list of ciphers when the user scrolls to the bottom of the list. Also sets up the
   * scroll listeners that reposition the passkeys and login headings when the user scrolls.
   */
  private setupCipherListScrollListeners() {
    const options = { passive: true };
    this.ciphersList.addEventListener(EVENTS.SCROLL, this.updateCiphersListOnScroll, options);
    if (this.showPasskeysLabels) {
      this.ciphersList.addEventListener(
        EVENTS.SCROLL,
        this.useEventHandlersMemo(
          throttle(this.handleThrottledOnScrollEvent, 50),
          UPDATE_PASSKEYS_HEADINGS_ON_SCROLL,
        ),
        options,
      );
    }
  }

  /**
   * Handles updating the list of ciphers when the
   * user scrolls to the bottom of the list.
   */
  private updateCiphersListOnScroll = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (this.cipherListScrollIsDebounced) {
      return;
    }

    this.cipherListScrollIsDebounced = true;
    if (this.cipherListScrollDebounceTimeout) {
      clearTimeout(this.cipherListScrollDebounceTimeout);
    }
    this.cipherListScrollDebounceTimeout = globalThis.setTimeout(
      this.handleDebouncedScrollEvent,
      300,
    );
  };

  /**
   * Debounced handler for updating the list of ciphers when the user scrolls to
   * the bottom of the list. Triggers at most once every 300ms.
   */
  private handleDebouncedScrollEvent = () => {
    this.cipherListScrollIsDebounced = false;
    const cipherListScrollTop = this.ciphersList.scrollTop;

    this.updatePasskeysHeadingsOnScroll(cipherListScrollTop);

    if (this.allCiphersLoaded()) {
      return;
    }

    if (!this.ciphersListHeight) {
      this.ciphersListHeight = this.ciphersList.offsetHeight;
    }

    const scrollPercentage =
      (cipherListScrollTop / (this.ciphersList.scrollHeight - this.ciphersListHeight)) * 100;
    if (scrollPercentage >= 80) {
      this.loadPageOfCiphers();
    }
  };

  /**
   * Throttled handler for updating the passkeys and login headings when the user scrolls the ciphers list.
   *
   * @param event - The scroll event.
   */
  private handleThrottledOnScrollEvent = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    this.updatePasskeysHeadingsOnScroll(this.ciphersList.scrollTop);
  };

  /**
   * Updates the passkeys and login headings when the user scrolls the ciphers list.
   *
   * @param cipherListScrollTop - The current scroll top position of the ciphers list.
   */
  private updatePasskeysHeadingsOnScroll = (cipherListScrollTop: number) => {
    if (!this.showPasskeysLabels) {
      return;
    }

    if (this.passkeysHeadingElement) {
      this.togglePasskeysHeadingAnchored(cipherListScrollTop);
      this.togglePasskeysHeadingBorder(cipherListScrollTop);
    }

    if (this.loginHeadingElement) {
      this.toggleLoginHeadingBorder(cipherListScrollTop);
    }
  };

  /**
   * Anchors the passkeys heading to the top of the last passkey item when the user scrolls.
   *
   * @param cipherListScrollTop - The current scroll top position of the ciphers list.
   */
  private togglePasskeysHeadingAnchored(cipherListScrollTop: number) {
    if (!this.passkeysHeadingHeight) {
      this.passkeysHeadingHeight = this.passkeysHeadingElement.offsetHeight;
    }

    const passkeysHeadingOffset = this.lastPasskeysListItem.offsetTop - this.passkeysHeadingHeight;
    if (cipherListScrollTop >= passkeysHeadingOffset) {
      this.passkeysHeadingElement.style.position = "relative";
      this.passkeysHeadingElement.style.top = `${passkeysHeadingOffset}px`;

      return;
    }

    this.passkeysHeadingElement.setAttribute("style", "");
  }

  /**
   * Toggles a border on the passkeys heading on scroll, adding it when the user has
   * scrolled at all and removing it once the user scrolls back to the top.
   *
   * @param cipherListScrollTop - The current scroll top position of the ciphers list.
   */
  private togglePasskeysHeadingBorder(cipherListScrollTop: number) {
    if (cipherListScrollTop < 1) {
      this.passkeysHeadingElement.classList.remove(this.headingBorderClass);
      return;
    }

    this.passkeysHeadingElement.classList.add(this.headingBorderClass);
  }

  /**
   * Toggles a border on  the login heading on scroll, adding it when the user has
   * scrolled past the last passkey item and removing it once the user scrolls back up.
   *
   * @param cipherListScrollTop - The current scroll top position of the ciphers list.
   */
  private toggleLoginHeadingBorder(cipherListScrollTop: number) {
    if (!this.lastPasskeysListItemHeight) {
      this.lastPasskeysListItemHeight = this.lastPasskeysListItem.offsetHeight;
    }

    const lastPasskeyOffset = this.lastPasskeysListItem.offsetTop + this.lastPasskeysListItemHeight;
    if (cipherListScrollTop < lastPasskeyOffset) {
      this.loginHeadingElement.classList.remove(this.headingBorderClass);
      return;
    }

    this.loginHeadingElement.classList.add(this.headingBorderClass);
  }

  /**
   * Builds the list item for a given cipher.
   *
   * @param cipher - The cipher to build the list item for.
   */
  private buildInlineMenuListActionsItem(cipher: InlineMenuCipherData) {
    this.buildPasskeysHeadingElements(cipher);

    const fillCipherElement = this.buildFillCipherElement(cipher);
    const viewCipherElement = this.buildViewCipherElement(cipher);

    const cipherContainerElement = globalThis.document.createElement("div");
    cipherContainerElement.classList.add("cipher-container");
    cipherContainerElement.append(fillCipherElement, viewCipherElement);

    const inlineMenuListActionsItem = globalThis.document.createElement("li");
    inlineMenuListActionsItem.setAttribute("role", "listitem");
    inlineMenuListActionsItem.classList.add("inline-menu-list-actions-item");
    inlineMenuListActionsItem.appendChild(cipherContainerElement);

    if (this.showPasskeysLabels && cipher.login?.passkey) {
      this.lastPasskeysListItem = inlineMenuListActionsItem;
    }

    return inlineMenuListActionsItem;
  }

  /**
   * Builds the passkeys and login headings for the list of cipher items.
   *
   * @param cipher - The cipher that will follow the heading.
   */
  private buildPasskeysHeadingElements(cipher: InlineMenuCipherData) {
    if (!this.showPasskeysLabels || (this.passkeysHeadingElement && this.loginHeadingElement)) {
      return;
    }

    const passkeyData = cipher.login?.passkey;
    if (!this.passkeysHeadingElement && passkeyData) {
      this.passkeysHeadingElement = globalThis.document.createElement("li");
      this.passkeysHeadingElement.classList.add("inline-menu-list-heading");
      this.passkeysHeadingElement.textContent = this.getTranslation("passkeys");
      this.ciphersList.appendChild(this.passkeysHeadingElement);

      return;
    }

    if (!this.passkeysHeadingElement || this.loginHeadingElement || passkeyData) {
      return;
    }

    this.loginHeadingElement = globalThis.document.createElement("li");
    this.loginHeadingElement.classList.add("inline-menu-list-heading");
    this.loginHeadingElement.textContent = this.getTranslation("passwords");
    this.ciphersList.appendChild(this.loginHeadingElement);
  }

  /**
   * Builds the fill cipher button for a given cipher.
   * Wraps the cipher icon and details.
   *
   * @param cipher - The cipher to build the fill cipher button for.
   */
  private buildFillCipherElement(cipher: InlineMenuCipherData) {
    const cipherIcon = this.buildCipherIconElement(cipher);
    const cipherDetailsElement = this.buildCipherDetailsElement(cipher);

    const fillCipherElement = globalThis.document.createElement("button");
    fillCipherElement.tabIndex = -1;
    fillCipherElement.classList.add("fill-cipher-button", "inline-menu-list-action");
    fillCipherElement.setAttribute(
      "aria-label",
      `${
        cipher.login?.passkey
          ? this.getTranslation("logInWithPasskeyAriaLabel")
          : this.getTranslation("fillCredentialsFor")
      } ${cipher.name}`,
    );

    this.addFillCipherElementAriaDescription(fillCipherElement, cipher);
    fillCipherElement.append(cipherIcon, cipherDetailsElement);
    fillCipherElement.addEventListener(EVENTS.CLICK, this.handleFillCipherClickEvent(cipher));
    fillCipherElement.addEventListener(EVENTS.KEYUP, this.handleFillCipherKeyUpEvent);

    return fillCipherElement;
  }

  /**
   * Adds an aria description to the fill cipher button for a given cipher.
   *
   * @param fillCipherElement - The fill cipher button element.
   * @param cipher - The cipher to add the aria description for.
   */
  private addFillCipherElementAriaDescription(
    fillCipherElement: HTMLButtonElement,
    cipher: InlineMenuCipherData,
  ) {
    if (cipher.login) {
      const passkeyUserName = cipher.login.passkey?.userName || "";
      const username = cipher.login.username || passkeyUserName;
      if (username) {
        fillCipherElement.setAttribute(
          "aria-description",
          `${this.getTranslation("username")?.toLowerCase()}: ${username}`,
        );
      }
      return;
    }

    if (cipher.card) {
      const cardParts = cipher.card.split(", *");
      if (cardParts.length === 1) {
        const cardDigits = cardParts[0].startsWith("*") ? cardParts[0].substring(1) : cardParts[0];
        fillCipherElement.setAttribute(
          "aria-description",
          `${this.getTranslation("cardNumberEndsWith")} ${cardDigits}`,
        );
        return;
      }

      const cardBrand = cardParts[0];
      const cardDigits = cardParts[1];
      fillCipherElement.setAttribute(
        "aria-description",
        `${cardBrand}, ${this.getTranslation("cardNumberEndsWith")} ${cardDigits}`,
      );
    }
  }

  /**
   * Handles the click event for the fill cipher button.
   * Sends a message to the parent window to fill the selected cipher.
   *
   * @param cipher - The cipher to fill.
   */
  private handleFillCipherClickEvent = (cipher: InlineMenuCipherData) => {
    const usePasskey = !!cipher.login?.passkey;
    return this.useEventHandlersMemo(
      () => this.triggerFillCipherClickEvent(cipher, usePasskey),
      `${cipher.id}-fill-cipher-button-click-handler-${usePasskey ? "passkey" : ""}`,
    );
  };

  /**
   * Triggers a fill of the currently selected cipher.
   *
   * @param cipher - The cipher to fill.
   * @param usePasskey - Whether the cipher uses a passkey.
   */
  private triggerFillCipherClickEvent = (cipher: InlineMenuCipherData, usePasskey: boolean) => {
    if (usePasskey) {
      this.createPasskeyAuthenticatingLoader();
    }

    this.postMessageToParent({
      command: "fillAutofillInlineMenuCipher",
      inlineMenuCipherId: cipher.id,
      usePasskey,
    });
  };

  /**
   * Handles the keyup event for the fill cipher button. Facilitates
   * selecting the next/previous cipher item on ArrowDown/ArrowUp. Also
   * facilitates moving keyboard focus to the view cipher button on ArrowRight.
   *
   * @param event - The keyup event.
   */
  private handleFillCipherKeyUpEvent = (event: KeyboardEvent) => {
    const listenedForKeys = new Set(["ArrowDown", "ArrowUp", "ArrowRight"]);
    if (!listenedForKeys.has(event.code) || !(event.target instanceof Element)) {
      return;
    }

    event.preventDefault();

    const currentListItem = event.target.closest(".inline-menu-list-actions-item") as HTMLElement;
    if (event.code === "ArrowDown") {
      this.focusNextListItem(currentListItem);
      return;
    }

    if (event.code === "ArrowUp") {
      this.focusPreviousListItem(currentListItem);
      return;
    }

    this.focusViewCipherButton(currentListItem, event.target as HTMLElement);
  };

  /**
   * Handles the keyup event for the "New Item" button. Allows for keyboard navigation
   * between ciphers elements if the other ciphers exist in the inline menu.
   *
   * @param event - The captured keyup event.
   */
  private handleNewItemButtonKeyUpEvent = (event: KeyboardEvent) => {
    const listenedForKeys = new Set(["ArrowDown", "ArrowUp"]);
    if (!listenedForKeys.has(event.code) || !(event.target instanceof Element)) {
      return;
    }

    if (event.code === "ArrowDown") {
      const firstFillButton = this.ciphersList.firstElementChild?.querySelector(
        ".fill-cipher-button",
      ) as HTMLButtonElement;
      firstFillButton?.focus();
      return;
    }

    const lastFillButton = this.ciphersList.lastElementChild?.querySelector(
      ".fill-cipher-button",
    ) as HTMLButtonElement;
    lastFillButton?.focus();
  };

  /**
   * Builds the button that facilitates viewing a cipher in the vault.
   *
   * @param cipher - The cipher to view.
   */
  private buildViewCipherElement(cipher: InlineMenuCipherData) {
    const viewCipherElement = globalThis.document.createElement("button");
    viewCipherElement.tabIndex = -1;
    viewCipherElement.classList.add("view-cipher-button");
    viewCipherElement.setAttribute(
      "aria-label",
      `${this.getTranslation("view")} ${cipher.name}, ${this.getTranslation("opensInANewWindow")}`,
    );
    viewCipherElement.append(buildSvgDomElement(viewCipherIcon));
    viewCipherElement.addEventListener(EVENTS.CLICK, this.handleViewCipherClickEvent(cipher));
    viewCipherElement.addEventListener(EVENTS.KEYUP, this.handleViewCipherKeyUpEvent);

    return viewCipherElement;
  }

  /**
   * Handles the click event for the view cipher button. Sends a
   * message to the parent window to view the selected cipher.
   *
   * @param cipher - The cipher to view.
   */
  private handleViewCipherClickEvent = (cipher: InlineMenuCipherData) => {
    return this.useEventHandlersMemo(
      () =>
        this.postMessageToParent({ command: "viewSelectedCipher", inlineMenuCipherId: cipher.id }),
      `${cipher.id}-view-cipher-button-click-handler`,
    );
  };

  /**
   * Handles the keyup event for the view cipher button. Facilitates
   * selecting the next/previous cipher item on ArrowDown/ArrowUp.
   * Also facilitates moving keyboard focus to the current fill
   * cipher button on ArrowLeft.
   *
   * @param event - The keyup event.
   */
  private handleViewCipherKeyUpEvent = (event: KeyboardEvent) => {
    const listenedForKeys = new Set(["ArrowDown", "ArrowUp", "ArrowLeft"]);
    if (!listenedForKeys.has(event.code) || !(event.target instanceof Element)) {
      return;
    }

    event.preventDefault();

    const currentListItem = event.target.closest(".inline-menu-list-actions-item") as HTMLElement;
    const cipherContainer = currentListItem.querySelector(".cipher-container") as HTMLElement;
    cipherContainer?.classList.remove("remove-outline");
    if (event.code === "ArrowDown") {
      this.focusNextListItem(currentListItem);
      return;
    }

    if (event.code === "ArrowUp") {
      this.focusPreviousListItem(currentListItem);
      return;
    }

    const previousSibling = event.target.previousElementSibling as HTMLElement;
    previousSibling?.focus();
  };

  /**
   * Builds the icon for a given cipher. Prioritizes the favicon from a given cipher url
   * and the default icon element within the extension. If neither are available, the
   * globe icon is used.
   *
   * @param cipher - The cipher to build the icon for.
   */
  private buildCipherIconElement(cipher: InlineMenuCipherData) {
    const cipherIcon = globalThis.document.createElement("span");
    cipherIcon.classList.add("cipher-icon");
    cipherIcon.setAttribute("aria-hidden", "true");

    if (cipher.login?.totpField && cipher.login?.totp) {
      const totpContainer = document.createElement("div");
      totpContainer.style.position = "relative";

      const svgElement = buildSvgDomElement(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29">
          <circle fill="none" cx="14.5" cy="14.5" r="12.5" 
                  stroke-width="3" stroke-dasharray="78.5" 
                  stroke-dashoffset="78.5" transform="rotate(-90 14.5 14.5)"></circle>
          <circle fill="none" cx="14.5" cy="14.5" r="14" stroke-width="1"></circle>
      </svg>
    `);

      const [innerCircleElement, outerCircleElement] = svgElement.querySelectorAll("circle");
      innerCircleElement.classList.add("circle-color");
      outerCircleElement.classList.add("circle-color");

      totpContainer.appendChild(svgElement);

      const totpSecondsSpan = document.createElement("span");
      totpSecondsSpan.classList.add("totp-sec-span");
      totpSecondsSpan.setAttribute("bitTypography", "helper");
      totpSecondsSpan.setAttribute("aria-label", this.getTranslation("totpSecondsSpanAria"));
      totpContainer.appendChild(totpSecondsSpan);

      cipherIcon.appendChild(totpContainer);

      const intervalSeconds = cipher.login.totpCodeTimeInterval;

      const updateCountdown = () => {
        const epoch = Math.round(Date.now() / 1000);
        const mod = epoch % intervalSeconds;
        const totpSeconds = intervalSeconds - mod;

        totpSecondsSpan.textContent = `${totpSeconds}`;

        /**
         * Design specifies a seven-second time span as the period where expiry is approaching.
         */
        const totpExpiryApproaching = totpSeconds <= 7;

        totpSecondsSpan.classList.toggle("totp-sec-span-danger", totpExpiryApproaching);
        innerCircleElement.classList.toggle("circle-danger-color", totpExpiryApproaching);
        outerCircleElement.classList.toggle("circle-danger-color", totpExpiryApproaching);

        innerCircleElement.style.strokeDashoffset = `${((intervalSeconds - totpSeconds) / intervalSeconds) * (2 * Math.PI * 12.5)}`;

        if (mod === 0) {
          this.postMessageToParent({ command: "refreshOverlayCiphers" });
        }
      };

      updateCountdown();
      setInterval(updateCountdown, 1000);

      return cipherIcon;
    }

    if (cipher.icon?.image) {
      try {
        const url = new URL(cipher.icon.image);
        cipherIcon.style.backgroundImage = `url(${url.href})`;

        const dummyImageElement = globalThis.document.createElement("img");
        dummyImageElement.src = url.href;
        dummyImageElement.addEventListener("error", () => {
          cipherIcon.style.backgroundImage = "";
          cipherIcon.classList.add("cipher-icon");
          cipherIcon.append(buildSvgDomElement(globeIcon));
        });
        dummyImageElement.remove();

        return cipherIcon;
      } catch {
        // Silently default to the globe icon element if the image URL is invalid
      }
    }

    if (!cipher.icon?.icon) {
      cipherIcon.append(buildSvgDomElement(globeIcon));
      return cipherIcon;
    }

    if (cipher.icon.icon.includes("bwi-credit-card")) {
      cipherIcon.append(buildSvgDomElement(creditCardIcon));
      return cipherIcon;
    }

    if (cipher.icon.icon.includes("bwi-id-card")) {
      cipherIcon.append(buildSvgDomElement(idCardIcon));
      return cipherIcon;
    }

    const iconClasses = cipher.icon.icon.split(" ");
    cipherIcon.classList.add("cipher-icon", "bwi", ...iconClasses);
    return cipherIcon;
  }

  /**
   * Builds the details for a given cipher. Includes the cipher name and subtitle.
   *
   * @param cipher - The cipher to build the details for.
   */
  private buildCipherDetailsElement(cipher: InlineMenuCipherData) {
    const cipherDetailsElement = globalThis.document.createElement("span");
    cipherDetailsElement.classList.add("cipher-details");

    const cipherNameElement = this.buildCipherNameElement(cipher);
    if (cipherNameElement) {
      cipherDetailsElement.appendChild(cipherNameElement);
    }

    if (cipher.login?.passkey) {
      return this.buildPasskeysCipherDetailsElement(cipher, cipherDetailsElement);
    }

    if (cipher.login?.totpField && cipher.login?.totp) {
      return this.buildTotpElement(cipher.login?.totp, cipher.login?.username, cipher.reprompt);
    }
    const subTitleText = this.getSubTitleText(cipher);
    const cipherSubtitleElement = this.buildCipherSubtitleElement(subTitleText);
    if (cipherSubtitleElement) {
      cipherDetailsElement.appendChild(cipherSubtitleElement);
    }

    return cipherDetailsElement;
  }

  /**
   * Checks if there is more than one TOTP element being displayed.
   *
   * @returns {boolean} - Returns true if more than one TOTP element is displayed, otherwise false.
   */
  private multipleTotpElements(): boolean {
    return (
      this.ciphers.filter((cipher) => cipher.login?.totpField && cipher.login?.totp).length > 1
    );
  }

  /**
   * Builds a TOTP element for a given TOTP code.
   *
   * @param totp - The TOTP code to display.
   */

  private buildTotpElement(
    totpCode: string,
    username: string,
    reprompt: CipherRepromptType,
  ): HTMLDivElement | null {
    if (!totpCode) {
      return null;
    }

    const formattedTotpCode = `${totpCode.substring(0, 3)} ${totpCode.substring(3)}`;

    const containerElement = globalThis.document.createElement("div");
    containerElement.classList.add("cipher-details");
    const totpHeading = document.createElement("span");
    totpHeading.classList.add("cipher-name");
    totpHeading.textContent = this.getTranslation("fillVerificationCode");
    totpHeading.setAttribute("aria-label", this.getTranslation("fillVerificationCodeAria"));

    containerElement.appendChild(totpHeading);

    if (this.multipleTotpElements() && username) {
      const usernameSubtitle = this.buildCipherSubtitleElement(username);
      containerElement.appendChild(usernameSubtitle);
    }

    const totpCodeSpan = document.createElement("span");
    totpCodeSpan.classList.toggle("cipher-subtitle");
    totpCodeSpan.classList.toggle("masked-totp", !!reprompt);
    totpCodeSpan.textContent = reprompt ? "●●●●●●" : formattedTotpCode;
    totpCodeSpan.setAttribute("aria-label", this.getTranslation("totpCodeAria"));
    totpCodeSpan.setAttribute("data-testid", "totp-code");
    containerElement.appendChild(totpCodeSpan);

    return containerElement;
  }

  /**
   * Builds the name element for a given cipher.
   *
   * @param cipher - The cipher to build the name element for.
   */
  private buildCipherNameElement(cipher: InlineMenuCipherData): HTMLSpanElement | null {
    if (!cipher.name) {
      return null;
    }

    const cipherNameElement = globalThis.document.createElement("span");
    cipherNameElement.classList.add("cipher-name");
    cipherNameElement.textContent = cipher.name;
    cipherNameElement.setAttribute("title", cipher.name);

    return cipherNameElement;
  }

  /**
   * Builds the subtitle element for a given cipher.
   *
   * @param subTitleText - The subtitle text to display.
   */
  private buildCipherSubtitleElement(subTitleText: string): HTMLSpanElement | null {
    if (!subTitleText) {
      return null;
    }

    const cipherSubtitleElement = globalThis.document.createElement("span");
    cipherSubtitleElement.classList.add("cipher-subtitle");
    cipherSubtitleElement.textContent = subTitleText;
    cipherSubtitleElement.setAttribute("title", subTitleText);

    return cipherSubtitleElement;
  }

  /**
   * Builds the passkeys details for a given cipher. Includes the passkey name and username.
   *
   * @param cipher - The cipher to build the passkey details for.
   * @param cipherDetailsElement - The cipher details element to append the passkey details to.
   */
  private buildPasskeysCipherDetailsElement(
    cipher: InlineMenuCipherData,
    cipherDetailsElement: HTMLSpanElement,
  ): HTMLSpanElement {
    let rpNameSubtitle: HTMLSpanElement;

    if (cipher.name !== cipher.login.passkey.rpName) {
      rpNameSubtitle = this.buildCipherSubtitleElement(cipher.login.passkey.rpName);
      if (rpNameSubtitle) {
        rpNameSubtitle.prepend(buildSvgDomElement(passkeyIcon));
        rpNameSubtitle.classList.add("cipher-subtitle--passkey");
        cipherDetailsElement.appendChild(rpNameSubtitle);
      }
    }

    if (cipher.login.username) {
      const usernameSubtitle = this.buildCipherSubtitleElement(cipher.login.username);
      if (usernameSubtitle) {
        if (!rpNameSubtitle) {
          usernameSubtitle.prepend(buildSvgDomElement(passkeyIcon));
          usernameSubtitle.classList.add("cipher-subtitle--passkey");
        }
        cipherDetailsElement.appendChild(usernameSubtitle);
      }

      return cipherDetailsElement;
    }

    const passkeySubtitle = this.buildCipherSubtitleElement(cipher.login.passkey.userName);
    if (passkeySubtitle) {
      if (!rpNameSubtitle) {
        passkeySubtitle.prepend(buildSvgDomElement(passkeyIcon));
        passkeySubtitle.classList.add("cipher-subtitle--passkey");
      }
      cipherDetailsElement.appendChild(passkeySubtitle);
    }

    return cipherDetailsElement;
  }

  /**
   * Creates an indicator for the user that the passkey is being authenticated.
   */
  private createPasskeyAuthenticatingLoader() {
    this.isPasskeyAuthInProgress = true;
    this.resetInlineMenuContainer();

    const passkeyAuthenticatingLoader = globalThis.document.createElement("div");
    passkeyAuthenticatingLoader.classList.add("passkey-authenticating-loader");
    passkeyAuthenticatingLoader.textContent = this.getTranslation("authenticating");
    passkeyAuthenticatingLoader.appendChild(buildSvgDomElement(spinnerIcon));

    this.inlineMenuListContainer.appendChild(passkeyAuthenticatingLoader);

    globalThis.setTimeout(() => {
      this.isPasskeyAuthInProgress = false;
      this.postMessageToParent({ command: "checkAutofillInlineMenuButtonFocused" });
    }, 4000);
  }

  /**
   * Gets the subtitle text for a given cipher.
   *
   * @param cipher - The cipher to get the subtitle text for.
   */
  private getSubTitleText(cipher: InlineMenuCipherData): string {
    if (cipher.identity?.username) {
      return cipher.identity.username;
    }

    if (cipher.identity?.fullName) {
      return cipher.identity.fullName;
    }

    if (cipher.login?.username) {
      return cipher.login.username;
    }

    if (cipher.card) {
      return cipher.card;
    }

    return "";
  }

  /**
   * Validates whether the inline menu list iframe is currently focused.
   * If not focused, will check if the button element is focused.
   */
  private checkInlineMenuListFocused() {
    if (globalThis.document.hasFocus()) {
      return;
    }

    if (this.isListHovered()) {
      globalThis.document.addEventListener(EVENTS.MOUSEOUT, this.handleMouseOutEvent);
      return;
    }

    this.postMessageToParent({ command: "checkAutofillInlineMenuButtonFocused" });
  }

  /**
   * Triggers a re-check of the list's focus status when the mouse leaves the list.
   */
  private handleMouseOutEvent = () => {
    globalThis.document.removeEventListener(EVENTS.MOUSEOUT, this.handleMouseOutEvent);
    this.checkInlineMenuListFocused();
  };

  /**
   * Validates whether the inline menu list iframe is currently hovered.
   */
  private isListHovered = () => {
    const hoveredElement = this.inlineMenuListContainer?.querySelector(":hover");
    return !!(
      hoveredElement &&
      (hoveredElement === this.inlineMenuListContainer ||
        this.inlineMenuListContainer.contains(hoveredElement))
    );
  };

  /**
   * Focuses the inline menu list iframe. The element that receives focus is
   * determined by the presence of the unlock button, new item button, or
   * the first cipher button.
   */
  private focusInlineMenuList() {
    this.inlineMenuListContainer.setAttribute("role", "dialog");
    this.inlineMenuListContainer.setAttribute("aria-modal", "true");

    const unlockButtonElement = this.inlineMenuListContainer.querySelector(
      "#unlock-button",
    ) as HTMLElement;
    if (unlockButtonElement) {
      unlockButtonElement.focus();
      return;
    }

    const firstListElement = this.inlineMenuListContainer.querySelector(
      ".inline-menu-list-action",
    ) as HTMLElement;
    firstListElement?.focus();
  }

  /**
   * Sets up the global listeners for the inline menu list iframe.
   */
  private setupInlineMenuListGlobalListeners() {
    this.setupGlobalListeners(this.inlineMenuListWindowMessageHandlers);

    this.resizeObserver = new ResizeObserver(this.handleResizeObserver);
  }

  /**
   * Handles the resize observer event. Facilitates updating the height of the
   * inline menu list iframe when the height of the list changes.
   *
   * @param entries - The resize observer entries.
   */
  private handleResizeObserver = (entries: ResizeObserverEntry[]) => {
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
      const entry = entries[entryIndex];
      if (entry.target !== this.inlineMenuListContainer) {
        continue;
      }

      const { height } = entry.contentRect;
      this.toggleScrollClass(height);
      this.postMessageToParent({
        command: "updateAutofillInlineMenuListHeight",
        styles: { height: `${height}px` },
      });
      break;
    }
  };

  /**
   * Toggles the scrollbar class on the inline menu list actions container.
   *
   * @param height - The height of the inline menu list actions container.
   */
  private toggleScrollClass = (height?: number) => {
    if (!this.ciphersList) {
      return;
    }
    const scrollbarClass = "inline-menu-list-actions--scrollbar";

    let containerHeight = height;
    if (!containerHeight) {
      const inlineMenuListContainerRects = this.inlineMenuListContainer.getBoundingClientRect();
      containerHeight = inlineMenuListContainerRects.height;
    }

    if (containerHeight >= 170) {
      this.ciphersList.classList.add(scrollbarClass);
      return;
    }

    this.ciphersList.classList.remove(scrollbarClass);
  };

  /**
   * Establishes a memoized event handler for a given event.
   *
   * @param eventHandler - The event handler to memoize.
   * @param memoIndex - The memo index to use for the event handler.
   */
  private useEventHandlersMemo = (eventHandler: EventListener, memoIndex: string) => {
    return this.eventHandlersMemo[memoIndex] || (this.eventHandlersMemo[memoIndex] = eventHandler);
  };

  /**
   * Focuses the next list item in the inline menu list. If the current list item is the last
   * item in the list, the first item is focused.
   *
   * @param currentListItem - The current list item.
   */
  private focusNextListItem(currentListItem: HTMLElement) {
    let nextListItem = currentListItem.nextSibling as HTMLElement;
    if (this.listItemIsHeadingElement(nextListItem)) {
      nextListItem = nextListItem.nextSibling as HTMLElement;
    }

    const nextSibling = nextListItem?.querySelector(".inline-menu-list-action") as HTMLElement;
    if (nextSibling) {
      nextSibling.focus();
      return;
    }

    if (this.newItemButtonElement) {
      this.newItemButtonElement.focus();
      return;
    }

    let firstListItem = currentListItem.parentElement?.firstChild as HTMLElement;
    if (this.listItemIsHeadingElement(firstListItem)) {
      firstListItem = firstListItem.nextSibling as HTMLElement;
    }

    const firstSibling = firstListItem?.querySelector(".inline-menu-list-action") as HTMLElement;
    firstSibling?.focus();
  }

  /**
   * Focuses the previous list item in the inline menu list. If the current list item is the first
   * item in the list, the last item is focused.
   *
   * @param currentListItem - The current list item.
   */
  private focusPreviousListItem(currentListItem: HTMLElement) {
    let previousListItem = currentListItem.previousSibling as HTMLElement;
    if (this.listItemIsHeadingElement(previousListItem)) {
      previousListItem = previousListItem.previousSibling as HTMLElement;
    }

    const previousSibling = previousListItem?.querySelector(
      ".inline-menu-list-action",
    ) as HTMLElement;
    if (previousSibling) {
      previousSibling.focus();
      return;
    }

    if (this.newItemButtonElement) {
      this.newItemButtonElement.focus();
      return;
    }

    const lastListItem = currentListItem.parentElement?.lastChild as HTMLElement;
    const lastSibling = lastListItem?.querySelector(".inline-menu-list-action") as HTMLElement;
    lastSibling?.focus();
  }

  /**
   * Focuses the view cipher button relative to the current fill cipher button.
   *
   * @param currentListItem - The current list item.
   * @param currentButtonElement - The current button element.
   */
  private focusViewCipherButton(currentListItem: HTMLElement, currentButtonElement: HTMLElement) {
    const cipherContainer = currentListItem.querySelector(".cipher-container") as HTMLElement;
    cipherContainer.classList.add("remove-outline");

    const nextSibling = currentButtonElement.nextElementSibling as HTMLElement;
    nextSibling?.focus();
  }

  /**
   * Identifies if the current focused field is filled by a login cipher.
   */
  private isFilledByLoginCipher = () => {
    return this.inlineMenuFillType === CipherType.Login;
  };

  /**
   * Identifies if the current focused field is filled by a card cipher.
   */
  private isFilledByCardCipher = () => {
    return this.inlineMenuFillType === CipherType.Card;
  };

  /**
   * Identifies if the current focused field is filled by an identity cipher.
   */
  private isFilledByIdentityCipher = () => {
    return this.inlineMenuFillType === CipherType.Identity;
  };

  /**
   * Identifies if the passed list item is a heading element.
   *
   * @param listItem - The list item to check.
   */
  private listItemIsHeadingElement = (listItem: HTMLElement) => {
    return listItem === this.passkeysHeadingElement || listItem === this.loginHeadingElement;
  };
}
