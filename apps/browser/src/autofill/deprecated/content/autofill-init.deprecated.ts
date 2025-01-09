// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AutofillInit } from "../../content/abstractions/autofill-init";
import AutofillPageDetails from "../../models/autofill-page-details";
import { CollectAutofillContentService } from "../../services/collect-autofill-content.service";
import DomElementVisibilityService from "../../services/dom-element-visibility.service";
import { DomQueryService } from "../../services/dom-query.service";
import InsertAutofillContentService from "../../services/insert-autofill-content.service";
import { sendExtensionMessage } from "../../utils";
import { LegacyAutofillOverlayContentService } from "../services/abstractions/autofill-overlay-content.service";

import {
  AutofillExtensionMessage,
  AutofillExtensionMessageHandlers,
} from "./abstractions/autofill-init.deprecated";

class LegacyAutofillInit implements AutofillInit {
  private readonly autofillOverlayContentService: LegacyAutofillOverlayContentService | undefined;
  private readonly domElementVisibilityService: DomElementVisibilityService;
  private readonly collectAutofillContentService: CollectAutofillContentService;
  private readonly insertAutofillContentService: InsertAutofillContentService;
  private collectPageDetailsOnLoadTimeout: number | NodeJS.Timeout | undefined;
  private readonly extensionMessageHandlers: AutofillExtensionMessageHandlers = {
    collectPageDetails: ({ message }) => this.collectPageDetails(message),
    collectPageDetailsImmediately: ({ message }) => this.collectPageDetails(message, true),
    fillForm: ({ message }) => this.fillForm(message),
    openAutofillOverlay: ({ message }) => this.openAutofillOverlay(message),
    closeAutofillOverlay: ({ message }) => this.removeAutofillOverlay(message),
    addNewVaultItemFromOverlay: () => this.addNewVaultItemFromOverlay(),
    redirectOverlayFocusOut: ({ message }) => this.redirectOverlayFocusOut(message),
    updateIsOverlayCiphersPopulated: ({ message }) => this.updateIsOverlayCiphersPopulated(message),
    bgUnlockPopoutOpened: () => this.blurAndRemoveOverlay(),
    bgVaultItemRepromptPopoutOpened: () => this.blurAndRemoveOverlay(),
    updateAutofillOverlayVisibility: ({ message }) => this.updateAutofillOverlayVisibility(message),
  };

  /**
   * AutofillInit constructor. Initializes the DomElementVisibilityService,
   * CollectAutofillContentService and InsertAutofillContentService classes.
   *
   * @param autofillOverlayContentService - The autofill overlay content service, potentially undefined.
   */
  constructor(autofillOverlayContentService?: LegacyAutofillOverlayContentService) {
    this.autofillOverlayContentService = autofillOverlayContentService;
    this.domElementVisibilityService = new DomElementVisibilityService();
    const domQueryService = new DomQueryService();
    this.collectAutofillContentService = new CollectAutofillContentService(
      this.domElementVisibilityService,
      domQueryService,
      this.autofillOverlayContentService,
    );
    this.insertAutofillContentService = new InsertAutofillContentService(
      this.domElementVisibilityService,
      this.collectAutofillContentService,
    );
  }

  /**
   * Initializes the autofill content script, setting up
   * the extension message listeners. This method should
   * be called once when the content script is loaded.
   */
  init() {
    this.setupExtensionMessageListeners();
    this.autofillOverlayContentService?.init();
    this.collectPageDetailsOnLoad();
  }

  /**
   * Triggers a collection of the page details from the
   * background script, ensuring that autofill is ready
   * to act on the page.
   */
  private collectPageDetailsOnLoad() {
    const sendCollectDetailsMessage = () => {
      this.clearCollectPageDetailsOnLoadTimeout();
      this.collectPageDetailsOnLoadTimeout = setTimeout(
        () => sendExtensionMessage("bgCollectPageDetails", { sender: "autofillInit" }),
        250,
      );
    };

    if (globalThis.document.readyState === "complete") {
      sendCollectDetailsMessage();
    }

    globalThis.addEventListener("load", sendCollectDetailsMessage);
  }

  /**
   * Collects the page details and sends them to the
   * extension background script. If the `sendDetailsInResponse`
   * parameter is set to true, the page details will be
   * returned to facilitate sending the details in the
   * response to the extension message.
   *
   * @param message - The extension message.
   * @param sendDetailsInResponse - Determines whether to send the details in the response.
   */
  private async collectPageDetails(
    message: AutofillExtensionMessage,
    sendDetailsInResponse = false,
  ): Promise<AutofillPageDetails | void> {
    const pageDetails: AutofillPageDetails =
      await this.collectAutofillContentService.getPageDetails();
    if (sendDetailsInResponse) {
      return pageDetails;
    }

    void chrome.runtime.sendMessage({
      command: "collectPageDetailsResponse",
      tab: message.tab,
      details: pageDetails,
      sender: message.sender,
    });
  }

  /**
   * Fills the form with the given fill script.
   *
   * @param {AutofillExtensionMessage} message
   */
  private async fillForm({ fillScript, pageDetailsUrl }: AutofillExtensionMessage) {
    if ((document.defaultView || window).location.href !== pageDetailsUrl) {
      return;
    }

    this.blurAndRemoveOverlay();
    this.updateOverlayIsCurrentlyFilling(true);
    await this.insertAutofillContentService.fillForm(fillScript);

    if (!this.autofillOverlayContentService) {
      return;
    }

    setTimeout(() => this.updateOverlayIsCurrentlyFilling(false), 250);
  }

  /**
   * Handles updating the overlay is currently filling value.
   *
   * @param isCurrentlyFilling - Indicates if the overlay is currently filling
   */
  private updateOverlayIsCurrentlyFilling(isCurrentlyFilling: boolean) {
    if (!this.autofillOverlayContentService) {
      return;
    }

    this.autofillOverlayContentService.isCurrentlyFilling = isCurrentlyFilling;
  }

  /**
   * Opens the autofill overlay.
   *
   * @param data - The extension message data.
   */
  private openAutofillOverlay({ data }: AutofillExtensionMessage) {
    if (!this.autofillOverlayContentService) {
      return;
    }

    this.autofillOverlayContentService.openAutofillOverlay(data);
  }

  /**
   * Blurs the most recent overlay field and removes the overlay. Used
   * in cases where the background unlock or vault item reprompt popout
   * is opened.
   */
  private blurAndRemoveOverlay() {
    if (!this.autofillOverlayContentService) {
      return;
    }

    this.autofillOverlayContentService.blurMostRecentOverlayField();
    this.removeAutofillOverlay();
  }

  /**
   * Removes the autofill overlay if the field is not currently focused.
   * If the autofill is currently filling, only the overlay list will be
   * removed.
   */
  private removeAutofillOverlay(message?: AutofillExtensionMessage) {
    if (message?.data?.forceCloseOverlay) {
      this.autofillOverlayContentService?.removeAutofillOverlay();
      return;
    }

    if (
      !this.autofillOverlayContentService ||
      this.autofillOverlayContentService.isFieldCurrentlyFocused
    ) {
      return;
    }

    if (this.autofillOverlayContentService.isCurrentlyFilling) {
      this.autofillOverlayContentService.removeAutofillOverlayList();
      return;
    }

    this.autofillOverlayContentService.removeAutofillOverlay();
  }

  /**
   * Adds a new vault item from the overlay.
   */
  private addNewVaultItemFromOverlay() {
    if (!this.autofillOverlayContentService) {
      return;
    }

    this.autofillOverlayContentService.addNewVaultItem();
  }

  /**
   * Redirects the overlay focus out of an overlay iframe.
   *
   * @param data - Contains the direction to redirect the focus.
   */
  private redirectOverlayFocusOut({ data }: AutofillExtensionMessage) {
    if (!this.autofillOverlayContentService) {
      return;
    }

    this.autofillOverlayContentService.redirectOverlayFocusOut(data?.direction);
  }

  /**
   * Updates whether the current tab has ciphers that can populate the overlay list
   *
   * @param data - Contains the isOverlayCiphersPopulated value
   *
   */
  private updateIsOverlayCiphersPopulated({ data }: AutofillExtensionMessage) {
    if (!this.autofillOverlayContentService) {
      return;
    }

    this.autofillOverlayContentService.isOverlayCiphersPopulated = Boolean(
      data?.isOverlayCiphersPopulated,
    );
  }

  /**
   * Updates the autofill overlay visibility.
   *
   * @param data - Contains the autoFillOverlayVisibility value
   */
  private updateAutofillOverlayVisibility({ data }: AutofillExtensionMessage) {
    if (!this.autofillOverlayContentService || isNaN(data?.autofillOverlayVisibility)) {
      return;
    }

    this.autofillOverlayContentService.autofillOverlayVisibility = data?.autofillOverlayVisibility;
  }

  /**
   * Clears the send collect details message timeout.
   */
  private clearCollectPageDetailsOnLoadTimeout() {
    if (this.collectPageDetailsOnLoadTimeout) {
      clearTimeout(this.collectPageDetailsOnLoadTimeout);
    }
  }

  /**
   * Sets up the extension message listeners for the content script.
   */
  private setupExtensionMessageListeners() {
    chrome.runtime.onMessage.addListener(this.handleExtensionMessage);
  }

  /**
   * Handles the extension messages sent to the content script.
   *
   * @param message - The extension message.
   * @param sender - The message sender.
   * @param sendResponse - The send response callback.
   */
  private handleExtensionMessage = (
    message: AutofillExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ): boolean => {
    const command: string = message.command;
    const handler: CallableFunction | undefined = this.extensionMessageHandlers[command];
    if (!handler) {
      return null;
    }

    const messageResponse = handler({ message, sender });
    if (typeof messageResponse === "undefined") {
      return null;
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.resolve(messageResponse).then((response) => sendResponse(response));
    return true;
  };

  /**
   * Handles destroying the autofill init content script. Removes all
   * listeners, timeouts, and object instances to prevent memory leaks.
   */
  destroy() {
    this.clearCollectPageDetailsOnLoadTimeout();
    chrome.runtime.onMessage.removeListener(this.handleExtensionMessage);
    this.collectAutofillContentService.destroy();
    this.autofillOverlayContentService?.destroy();
  }
}

export default LegacyAutofillInit;
