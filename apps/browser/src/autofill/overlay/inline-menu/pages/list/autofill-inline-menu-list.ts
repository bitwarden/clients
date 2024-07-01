import "@webcomponents/custom-elements";
import "lit/polyfill-support.js";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EVENTS } from "@bitwarden/common/autofill/constants";
import { CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../../../../background/abstractions/overlay.background";
import { buildSvgDomElement } from "../../../../utils";
import { globeIcon, lockIcon, plusIcon, viewCipherIcon } from "../../../../utils/svg-icons";
import {
  AutofillInlineMenuListWindowMessageHandlers,
  InitAutofillInlineMenuListMessage,
} from "../../abstractions/autofill-inline-menu-list";
import { AutofillInlineMenuPageElement } from "../shared/autofill-inline-menu-page-element";

export class AutofillInlineMenuList extends AutofillInlineMenuPageElement {
  private inlineMenuListContainer: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private eventHandlersMemo: { [key: string]: EventListener } = {};
  private ciphers: InlineMenuCipherData[] = [];
  private ciphersList: HTMLUListElement;
  private cipherListScrollIsDebounced = false;
  private cipherListScrollDebounceTimeout: number | NodeJS.Timeout;
  private currentCipherIndex = 0;
  private filledByCipherType: CipherType;
  private readonly showCiphersPerPage = 6;
  private readonly inlineMenuListWindowMessageHandlers: AutofillInlineMenuListWindowMessageHandlers =
    {
      initAutofillInlineMenuList: ({ message }) => this.initAutofillInlineMenuList(message),
      checkAutofillInlineMenuListFocused: () => this.checkInlineMenuListFocused(),
      updateAutofillInlineMenuListCiphers: ({ message }) => this.updateListItems(message.ciphers),
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
   * @param translations - The translations to use for the inline menu list.
   * @param styleSheetUrl - The URL of the stylesheet to use for the inline menu list.
   * @param theme - The theme to use for the inline menu list.
   * @param authStatus - The current authentication status.
   * @param ciphers - The ciphers to display in the inline menu list.
   * @param portKey - Background generated key that allows the port to communicate with the background.
   * @param filledByCipherType - The type of cipher that fills the current field.
   */
  private async initAutofillInlineMenuList({
    translations,
    styleSheetUrl,
    theme,
    authStatus,
    ciphers,
    portKey,
    filledByCipherType,
  }: InitAutofillInlineMenuListMessage) {
    const linkElement = await this.initAutofillInlineMenuPage(
      "list",
      styleSheetUrl,
      translations,
      portKey,
    );

    this.filledByCipherType = filledByCipherType;

    const themeClass = `theme_${theme}`;
    globalThis.document.documentElement.classList.add(themeClass);

    this.inlineMenuListContainer = globalThis.document.createElement("div");
    this.inlineMenuListContainer.classList.add("inline-menu-list-container", themeClass);
    this.resizeObserver.observe(this.inlineMenuListContainer);

    this.shadowDom.append(linkElement, this.inlineMenuListContainer);

    if (authStatus === AuthenticationStatus.Unlocked) {
      this.updateListItems(ciphers);
      return;
    }

    this.buildLockedInlineMenu();
  }

  /**
   * Builds the locked inline menu, which is displayed when the user is not authenticated.
   * Facilitates the ability to unlock the extension from the inline menu.
   */
  private buildLockedInlineMenu() {
    const lockedInlineMenu = globalThis.document.createElement("div");
    lockedInlineMenu.id = "locked-inline-menu-description";
    lockedInlineMenu.classList.add("locked-inline-menu", "inline-menu-list-message");
    lockedInlineMenu.textContent = this.getTranslation("unlockYourAccount");

    const unlockButtonElement = globalThis.document.createElement("button");
    unlockButtonElement.id = "unlock-button";
    unlockButtonElement.tabIndex = -1;
    unlockButtonElement.classList.add("unlock-button", "inline-menu-list-button");
    unlockButtonElement.textContent = this.getTranslation("unlockAccount");
    unlockButtonElement.setAttribute(
      "aria-label",
      `${this.getTranslation("unlockAccount")}, ${this.getTranslation("opensInANewWindow")}`,
    );
    unlockButtonElement.prepend(buildSvgDomElement(lockIcon));
    unlockButtonElement.addEventListener(EVENTS.CLICK, this.handleUnlockButtonClick);

    const inlineMenuListButtonContainer = globalThis.document.createElement("div");
    inlineMenuListButtonContainer.classList.add("inline-menu-list-button-container");
    inlineMenuListButtonContainer.appendChild(unlockButtonElement);

    this.inlineMenuListContainer.append(lockedInlineMenu, inlineMenuListButtonContainer);
  }

  /**
   * Handles the click event for the unlock button.
   * Sends a message to the parent window to unlock the vault.
   */
  private handleUnlockButtonClick = () => {
    this.postMessageToParent({ command: "unlockVault" });
  };

  /**
   * Updates the list items with the passed ciphers.
   * If no ciphers are passed, the no results inline menu is built.
   *
   * @param ciphers - The ciphers to display in the inline menu list.
   */
  private updateListItems(ciphers: InlineMenuCipherData[]) {
    this.ciphers = ciphers;
    this.currentCipherIndex = 0;
    if (this.inlineMenuListContainer) {
      this.inlineMenuListContainer.innerHTML = "";
    }

    if (!ciphers?.length) {
      this.buildNoResultsInlineMenuList();
      return;
    }

    this.ciphersList = globalThis.document.createElement("ul");
    this.ciphersList.classList.add("inline-menu-list-actions");
    this.ciphersList.setAttribute("role", "list");
    globalThis.addEventListener(EVENTS.SCROLL, this.handleCiphersListScrollEvent);

    this.loadPageOfCiphers();

    this.inlineMenuListContainer.appendChild(this.ciphersList);
  }

  /**
   * Inline menu view that is presented when no ciphers are found for a given page.
   * Facilitates the ability to add a new vault item from the inline menu.
   */
  private buildNoResultsInlineMenuList() {
    const noItemsMessage = globalThis.document.createElement("div");
    noItemsMessage.classList.add("no-items", "inline-menu-list-message");
    noItemsMessage.textContent = this.getTranslation("noItemsToShow");

    const newItemButton = globalThis.document.createElement("button");
    newItemButton.tabIndex = -1;
    newItemButton.id = "new-item-button";
    newItemButton.classList.add("add-new-item-button", "inline-menu-list-button");
    newItemButton.textContent = this.getNewItemButtonText();
    newItemButton.setAttribute(
      "aria-label",
      `${this.getNewItemAriaLabel()}, ${this.getTranslation("opensInANewWindow")}`,
    );
    newItemButton.prepend(buildSvgDomElement(plusIcon));
    newItemButton.addEventListener(EVENTS.CLICK, this.handeNewItemButtonClick);

    const inlineMenuListButtonContainer = globalThis.document.createElement("div");
    inlineMenuListButtonContainer.classList.add("inline-menu-list-button-container");
    inlineMenuListButtonContainer.appendChild(newItemButton);

    this.inlineMenuListContainer.append(noItemsMessage, inlineMenuListButtonContainer);
  }

  /**
   * Gets the new item text for the button based on the cipher type the focused field is filled by.
   */
  private getNewItemButtonText() {
    if (this.filledByCipherType === CipherType.Login) {
      return this.getTranslation("newLogin");
    }

    if (this.filledByCipherType === CipherType.Card) {
      return this.getTranslation("newCard");
    }

    return this.getTranslation("newItem");
  }

  /**
   * Gets the aria label for the new item button based on the cipher type the focused field is filled by.
   */
  private getNewItemAriaLabel() {
    if (this.filledByCipherType === CipherType.Login) {
      return this.getTranslation("addNewLoginItem");
    }

    if (this.filledByCipherType === CipherType.Card) {
      return this.getTranslation("addNewCardItem");
    }

    return this.getTranslation("addNewVaultItem");
  }

  /**
   * Handles the click event for the new item button.
   * Sends a message to the parent window to add a new vault item.
   */
  private handeNewItemButtonClick = () => {
    this.postMessageToParent({
      command: "addNewVaultItem",
      addNewCipherType: this.filledByCipherType,
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

    if (this.currentCipherIndex >= this.ciphers.length) {
      globalThis.removeEventListener(EVENTS.SCROLL, this.handleCiphersListScrollEvent);
    }
  }

  /**
   * Handles updating the list of ciphers when the
   * user scrolls to the bottom of the list.
   */
  private handleCiphersListScrollEvent = () => {
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

    if (globalThis.scrollY + globalThis.innerHeight >= this.ciphersList.clientHeight - 300) {
      this.loadPageOfCiphers();
    }
  };

  /**
   * Builds the list item for a given cipher.
   *
   * @param cipher - The cipher to build the list item for.
   */
  private buildInlineMenuListActionsItem(cipher: InlineMenuCipherData) {
    const fillCipherElement = this.buildFillCipherElement(cipher);
    const viewCipherElement = this.buildViewCipherElement(cipher);

    const cipherContainerElement = globalThis.document.createElement("div");
    cipherContainerElement.classList.add("cipher-container");
    cipherContainerElement.append(fillCipherElement, viewCipherElement);

    const inlineMenuListActionsItem = globalThis.document.createElement("li");
    inlineMenuListActionsItem.setAttribute("role", "listitem");
    inlineMenuListActionsItem.classList.add("inline-menu-list-actions-item");
    inlineMenuListActionsItem.appendChild(cipherContainerElement);

    return inlineMenuListActionsItem;
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
    fillCipherElement.classList.add("fill-cipher-button");
    fillCipherElement.setAttribute(
      "aria-label",
      `${this.getTranslation("fillCredentialsFor")} ${cipher.name}`,
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
      fillCipherElement.setAttribute(
        "aria-description",
        `${this.getTranslation("username")}, ${cipher.login.username}`,
      );
      return;
    }

    if (cipher.card) {
      const cardParts = cipher.card.split(", *");
      const cardBrand = cardParts[0];
      const lastFour = cardParts[1];

      fillCipherElement.setAttribute(
        "aria-description",
        `${cardBrand}, ${this.getTranslation("cardNumberEndsWith")} ${lastFour}`,
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
    return this.useEventHandlersMemo(
      () =>
        this.postMessageToParent({
          command: "fillAutofillInlineMenuCipher",
          inlineMenuCipherId: cipher.id,
        }),
      `${cipher.id}-fill-cipher-button-click-handler`,
    );
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

    if (cipher.icon?.image) {
      try {
        const url = new URL(cipher.icon.image);
        cipherIcon.style.backgroundImage = `url(${url.href})`;

        const dummyImageElement = globalThis.document.createElement("img");
        dummyImageElement.src = url.href;
        dummyImageElement.addEventListener("error", () => {
          cipherIcon.style.backgroundImage = "";
          const iconClasses = cipher.icon.icon.split(" ");
          cipherIcon.classList.add("cipher-icon", "bwi", ...iconClasses);
        });
        dummyImageElement.remove();

        return cipherIcon;
      } catch {
        // Silently default to the globe icon element if the image URL is invalid
      }
    }

    if (cipher.icon?.icon) {
      const iconClasses = cipher.icon.icon.split(" ");
      cipherIcon.classList.add("cipher-icon", "bwi", ...iconClasses);
      return cipherIcon;
    }

    cipherIcon.append(buildSvgDomElement(globeIcon));
    return cipherIcon;
  }

  /**
   * Builds the details for a given cipher. Includes the cipher name and subtitle.
   *
   * @param cipher - The cipher to build the details for.
   */
  private buildCipherDetailsElement(cipher: InlineMenuCipherData) {
    const cipherNameElement = this.buildCipherNameElement(cipher);
    const cipherSubtitleElement = this.buildCipherSubtitleElement(cipher);

    const cipherDetailsElement = globalThis.document.createElement("span");
    cipherDetailsElement.classList.add("cipher-details");
    if (cipherNameElement) {
      cipherDetailsElement.appendChild(cipherNameElement);
    }
    if (cipherSubtitleElement) {
      cipherDetailsElement.appendChild(cipherSubtitleElement);
    }

    return cipherDetailsElement;
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
   * @param cipher - The cipher to build the username login element for.
   */
  private buildCipherSubtitleElement(cipher: InlineMenuCipherData): HTMLSpanElement | null {
    const subTitleText = cipher.login?.username || cipher.card;
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
   * Validates whether the inline menu list iframe is currently focused.
   * If not focused, will check if the button element is focused.
   */
  private checkInlineMenuListFocused() {
    if (globalThis.document.hasFocus() || this.inlineMenuListContainer.matches(":hover")) {
      return;
    }

    this.postMessageToParent({ command: "checkAutofillInlineMenuButtonFocused" });
  }

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

    const newItemButtonElement = this.inlineMenuListContainer.querySelector(
      "#new-item-button",
    ) as HTMLElement;
    if (newItemButtonElement) {
      newItemButtonElement.focus();
      return;
    }

    const firstCipherElement = this.inlineMenuListContainer.querySelector(
      ".fill-cipher-button",
    ) as HTMLElement;
    firstCipherElement?.focus();
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
      this.postMessageToParent({
        command: "updateAutofillInlineMenuListHeight",
        styles: { height: `${height}px` },
      });
      break;
    }
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
    const nextListItem = currentListItem.nextSibling as HTMLElement;
    const nextSibling = nextListItem?.querySelector(".fill-cipher-button") as HTMLElement;
    if (nextSibling) {
      nextSibling.focus();
      return;
    }

    const firstListItem = currentListItem.parentElement?.firstChild as HTMLElement;
    const firstSibling = firstListItem?.querySelector(".fill-cipher-button") as HTMLElement;
    firstSibling?.focus();
  }

  /**
   * Focuses the previous list item in the inline menu list. If the current list item is the first
   * item in the list, the last item is focused.
   *
   * @param currentListItem - The current list item.
   */
  private focusPreviousListItem(currentListItem: HTMLElement) {
    const previousListItem = currentListItem.previousSibling as HTMLElement;
    const previousSibling = previousListItem?.querySelector(".fill-cipher-button") as HTMLElement;
    if (previousSibling) {
      previousSibling.focus();
      return;
    }

    const lastListItem = currentListItem.parentElement?.lastChild as HTMLElement;
    const lastSibling = lastListItem?.querySelector(".fill-cipher-button") as HTMLElement;
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
}
