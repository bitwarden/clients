// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import "@webcomponents/custom-elements";
import "lit/polyfill-support.js";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EVENTS } from "@bitwarden/common/autofill/constants";

import { buildSvgDomElement } from "../../../../utils";
import { globeIcon, lockIcon, plusIcon, viewCipherIcon } from "../../../../utils/svg-icons";
import { OverlayCipherData } from "../../../background/abstractions/overlay.background.deprecated";
import {
  InitAutofillOverlayListMessage,
  OverlayListWindowMessageHandlers,
} from "../../abstractions/autofill-overlay-list.deprecated";
import AutofillOverlayPageElement from "../shared/autofill-overlay-page-element.deprecated";

class AutofillOverlayList extends AutofillOverlayPageElement {
  private overlayListContainer: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private eventHandlersMemo: { [key: string]: EventListener } = {};
  private ciphers: OverlayCipherData[] = [];
  private ciphersList: HTMLUListElement;
  private cipherListScrollIsDebounced = false;
  private cipherListScrollDebounceTimeout: number | NodeJS.Timeout;
  private currentCipherIndex = 0;
  private readonly showCiphersPerPage = 6;
  private readonly overlayListWindowMessageHandlers: OverlayListWindowMessageHandlers = {
    initAutofillOverlayList: ({ message }) => this.initAutofillOverlayList(message),
    checkAutofillOverlayListFocused: () => this.checkOverlayListFocused(),
    updateOverlayListCiphers: ({ message }) => this.updateListItems(message.ciphers),
    focusOverlayList: () => this.focusOverlayList(),
  };

  constructor() {
    super();

    this.setupOverlayListGlobalListeners();
  }

  /**
   * Initializes the overlay list and updates the list items with the passed ciphers.
   * If the auth status is not `Unlocked`, the locked overlay is built.
   *
   * @param translations - The translations to use for the overlay list.
   * @param styleSheetUrl - The URL of the stylesheet to use for the overlay list.
   * @param theme - The theme to use for the overlay list.
   * @param authStatus - The current authentication status.
   * @param ciphers - The ciphers to display in the overlay list.
   */
  private async initAutofillOverlayList({
    translations,
    styleSheetUrl,
    theme,
    authStatus,
    ciphers,
  }: InitAutofillOverlayListMessage) {
    const linkElement = this.initOverlayPage("list", styleSheetUrl, translations);

    const themeClass = `theme_${theme}`;
    globalThis.document.documentElement.classList.add(themeClass);

    this.overlayListContainer = globalThis.document.createElement("div");
    this.overlayListContainer.classList.add("overlay-list-container", themeClass);
    this.resizeObserver.observe(this.overlayListContainer);

    this.shadowDom.append(linkElement, this.overlayListContainer);

    if (authStatus === AuthenticationStatus.Unlocked) {
      this.updateListItems(ciphers);
      return;
    }

    this.buildLockedOverlay();
  }

  /**
   * Builds the locked overlay, which is displayed when the user is not authenticated.
   * Facilitates the ability to unlock the extension from the overlay.
   */
  private buildLockedOverlay() {
    const lockedOverlay = globalThis.document.createElement("div");
    lockedOverlay.id = "locked-overlay-description";
    lockedOverlay.classList.add("locked-overlay", "overlay-list-message");
    lockedOverlay.textContent = this.getTranslation("unlockYourAccount");

    const unlockButtonElement = globalThis.document.createElement("button");
    unlockButtonElement.id = "unlock-button";
    unlockButtonElement.tabIndex = -1;
    unlockButtonElement.classList.add("unlock-button", "overlay-list-button");
    unlockButtonElement.textContent = this.getTranslation("unlockAccount");
    unlockButtonElement.setAttribute(
      "aria-label",
      `${this.getTranslation("unlockAccount")}, ${this.getTranslation("opensInANewWindow")}`,
    );
    unlockButtonElement.prepend(buildSvgDomElement(lockIcon));
    unlockButtonElement.addEventListener(EVENTS.CLICK, this.handleUnlockButtonClick);

    const overlayListButtonContainer = globalThis.document.createElement("div");
    overlayListButtonContainer.classList.add("overlay-list-button-container");
    overlayListButtonContainer.appendChild(unlockButtonElement);

    this.overlayListContainer.append(lockedOverlay, overlayListButtonContainer);
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
   * If no ciphers are passed, the no results overlay is built.
   *
   * @param ciphers - The ciphers to display in the overlay list.
   */
  private updateListItems(ciphers: OverlayCipherData[]) {
    this.ciphers = ciphers;
    this.currentCipherIndex = 0;
    if (this.overlayListContainer) {
      this.overlayListContainer.innerHTML = "";
    }

    if (!ciphers?.length) {
      this.buildNoResultsOverlayList();
      return;
    }

    this.ciphersList = globalThis.document.createElement("ul");
    this.ciphersList.classList.add("overlay-actions-list");
    this.ciphersList.setAttribute("role", "list");
    globalThis.addEventListener(EVENTS.SCROLL, this.handleCiphersListScrollEvent);

    this.loadPageOfCiphers();

    this.overlayListContainer.appendChild(this.ciphersList);
  }

  /**
   * Overlay view that is presented when no ciphers are found for a given page.
   * Facilitates the ability to add a new vault item from the overlay.
   */
  private buildNoResultsOverlayList() {
    const noItemsMessage = globalThis.document.createElement("div");
    noItemsMessage.classList.add("no-items", "overlay-list-message");
    noItemsMessage.textContent = this.getTranslation("noItemsToShow");

    const newItemButton = globalThis.document.createElement("button");
    newItemButton.tabIndex = -1;
    newItemButton.id = "new-item-button";
    newItemButton.classList.add("add-new-item-button", "overlay-list-button");
    newItemButton.textContent = this.getTranslation("newItem");
    newItemButton.setAttribute(
      "aria-label",
      `${this.getTranslation("addNewVaultItem")}, ${this.getTranslation("opensInANewWindow")}`,
    );
    newItemButton.prepend(buildSvgDomElement(plusIcon));
    newItemButton.addEventListener(EVENTS.CLICK, this.handeNewItemButtonClick);

    const overlayListButtonContainer = globalThis.document.createElement("div");
    overlayListButtonContainer.classList.add("overlay-list-button-container");
    overlayListButtonContainer.appendChild(newItemButton);

    this.overlayListContainer.append(noItemsMessage, overlayListButtonContainer);
  }

  /**
   * Handles the click event for the new item button.
   * Sends a message to the parent window to add a new vault item.
   */
  private handeNewItemButtonClick = () => {
    this.postMessageToParent({ command: "addNewVaultItem" });
  };

  /**
   * Loads a page of ciphers into the overlay list container.
   */
  private loadPageOfCiphers() {
    const lastIndex = Math.min(
      this.currentCipherIndex + this.showCiphersPerPage,
      this.ciphers.length,
    );
    for (let cipherIndex = this.currentCipherIndex; cipherIndex < lastIndex; cipherIndex++) {
      this.ciphersList.appendChild(this.buildOverlayActionsListItem(this.ciphers[cipherIndex]));
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
    this.cipherListScrollDebounceTimeout = setTimeout(this.handleDebouncedScrollEvent, 300);
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
  private buildOverlayActionsListItem(cipher: OverlayCipherData) {
    const fillCipherElement = this.buildFillCipherElement(cipher);
    const viewCipherElement = this.buildViewCipherElement(cipher);

    const cipherContainerElement = globalThis.document.createElement("div");
    cipherContainerElement.classList.add("cipher-container");
    cipherContainerElement.append(fillCipherElement, viewCipherElement);

    const overlayActionsListItem = globalThis.document.createElement("li");
    overlayActionsListItem.setAttribute("role", "listitem");
    overlayActionsListItem.classList.add("overlay-actions-list-item");
    overlayActionsListItem.appendChild(cipherContainerElement);

    return overlayActionsListItem;
  }

  /**
   * Builds the fill cipher button for a given cipher.
   * Wraps the cipher icon and details.
   *
   * @param cipher - The cipher to build the fill cipher button for.
   */
  private buildFillCipherElement(cipher: OverlayCipherData) {
    const cipherIcon = this.buildCipherIconElement(cipher);
    const cipherDetailsElement = this.buildCipherDetailsElement(cipher);

    const fillCipherElement = globalThis.document.createElement("button");
    fillCipherElement.tabIndex = -1;
    fillCipherElement.classList.add("fill-cipher-button");
    fillCipherElement.setAttribute(
      "aria-label",
      `${this.getTranslation("fillCredentialsFor")} ${cipher.name}`,
    );
    fillCipherElement.setAttribute(
      "aria-description",
      `${this.getTranslation("partialUsername")}, ${cipher.login.username}`,
    );
    fillCipherElement.append(cipherIcon, cipherDetailsElement);
    fillCipherElement.addEventListener(EVENTS.CLICK, this.handleFillCipherClickEvent(cipher));
    fillCipherElement.addEventListener(EVENTS.KEYUP, this.handleFillCipherKeyUpEvent);

    return fillCipherElement;
  }

  /**
   * Handles the click event for the fill cipher button.
   * Sends a message to the parent window to fill the selected cipher.
   *
   * @param cipher - The cipher to fill.
   */
  private handleFillCipherClickEvent = (cipher: OverlayCipherData) => {
    return this.useEventHandlersMemo(
      () =>
        this.postMessageToParent({
          command: "fillSelectedListItem",
          overlayCipherId: cipher.id,
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

    const currentListItem = event.target.closest(".overlay-actions-list-item") as HTMLElement;
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
  private buildViewCipherElement(cipher: OverlayCipherData) {
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
  private handleViewCipherClickEvent = (cipher: OverlayCipherData) => {
    return this.useEventHandlersMemo(
      () => this.postMessageToParent({ command: "viewSelectedCipher", overlayCipherId: cipher.id }),
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

    const currentListItem = event.target.closest(".overlay-actions-list-item") as HTMLElement;
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
  private buildCipherIconElement(cipher: OverlayCipherData) {
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
          cipherIcon.classList.add("cipher-icon");
          cipherIcon.append(buildSvgDomElement(globeIcon));
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
   * Builds the details for a given cipher. Includes the cipher name and username login.
   *
   * @param cipher - The cipher to build the details for.
   */
  private buildCipherDetailsElement(cipher: OverlayCipherData) {
    const cipherNameElement = this.buildCipherNameElement(cipher);
    const cipherUserLoginElement = this.buildCipherUserLoginElement(cipher);

    const cipherDetailsElement = globalThis.document.createElement("span");
    cipherDetailsElement.classList.add("cipher-details");
    if (cipherNameElement) {
      cipherDetailsElement.appendChild(cipherNameElement);
    }
    if (cipherUserLoginElement) {
      cipherDetailsElement.appendChild(cipherUserLoginElement);
    }

    return cipherDetailsElement;
  }

  /**
   * Builds the name element for a given cipher.
   *
   * @param cipher - The cipher to build the name element for.
   */
  private buildCipherNameElement(cipher: OverlayCipherData): HTMLSpanElement | null {
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
   * Builds the username login element for a given cipher.
   *
   * @param cipher - The cipher to build the username login element for.
   */
  private buildCipherUserLoginElement(cipher: OverlayCipherData): HTMLSpanElement | null {
    if (!cipher.login?.username) {
      return null;
    }

    const cipherUserLoginElement = globalThis.document.createElement("span");
    cipherUserLoginElement.classList.add("cipher-user-login");
    cipherUserLoginElement.textContent = cipher.login.username;
    cipherUserLoginElement.setAttribute("title", cipher.login.username);

    return cipherUserLoginElement;
  }

  /**
   * Validates whether the overlay list iframe is currently focused.
   * If not focused, will check if the button element is focused.
   */
  private checkOverlayListFocused() {
    if (globalThis.document.hasFocus()) {
      return;
    }

    this.postMessageToParent({ command: "checkAutofillOverlayButtonFocused" });
  }

  /**
   * Focuses the overlay list iframe. The element that receives focus is
   * determined by the presence of the unlock button, new item button, or
   * the first cipher button.
   */
  private focusOverlayList() {
    this.overlayListContainer.setAttribute("role", "dialog");
    this.overlayListContainer.setAttribute("aria-modal", "true");

    const unlockButtonElement = this.overlayListContainer.querySelector(
      "#unlock-button",
    ) as HTMLElement;
    if (unlockButtonElement) {
      unlockButtonElement.focus();
      return;
    }

    const newItemButtonElement = this.overlayListContainer.querySelector(
      "#new-item-button",
    ) as HTMLElement;
    if (newItemButtonElement) {
      newItemButtonElement.focus();
      return;
    }

    const firstCipherElement = this.overlayListContainer.querySelector(
      ".fill-cipher-button",
    ) as HTMLElement;
    firstCipherElement?.focus();
  }

  /**
   * Sets up the global listeners for the overlay list iframe.
   */
  private setupOverlayListGlobalListeners() {
    this.setupGlobalListeners(this.overlayListWindowMessageHandlers);

    this.resizeObserver = new ResizeObserver(this.handleResizeObserver);
  }

  /**
   * Handles the resize observer event. Facilitates updating the height of the
   * overlay list iframe when the height of the list changes.
   *
   * @param entries - The resize observer entries.
   */
  private handleResizeObserver = (entries: ResizeObserverEntry[]) => {
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
      const entry = entries[entryIndex];
      if (entry.target !== this.overlayListContainer) {
        continue;
      }

      const { height } = entry.contentRect;
      this.postMessageToParent({
        command: "updateAutofillOverlayListHeight",
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
   * Focuses the next list item in the overlay list. If the current list item is the last
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
   * Focuses the previous list item in the overlay list. If the current list item is the first
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

export default AutofillOverlayList;
