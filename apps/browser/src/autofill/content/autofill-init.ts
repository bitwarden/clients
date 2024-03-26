import { SubFrameOffsetData } from "../background/abstractions/overlay.background";
import AutofillPageDetails from "../models/autofill-page-details";
import { InlineMenuElements } from "../overlay/abstractions/inline-menu-elements";
import { AutofillOverlayContentService } from "../services/abstractions/autofill-overlay-content.service";
import CollectAutofillContentService from "../services/collect-autofill-content.service";
import DomElementVisibilityService from "../services/dom-element-visibility.service";
import InsertAutofillContentService from "../services/insert-autofill-content.service";
import { sendExtensionMessage } from "../utils";

import {
  AutofillExtensionMessage,
  AutofillExtensionMessageHandlers,
  AutofillInit as AutofillInitInterface,
} from "./abstractions/autofill-init";

class AutofillInit implements AutofillInitInterface {
  private readonly autofillOverlayContentService: AutofillOverlayContentService | undefined;
  private readonly inlineMenuElements: InlineMenuElements | undefined;
  private readonly domElementVisibilityService: DomElementVisibilityService;
  private readonly collectAutofillContentService: CollectAutofillContentService;
  private readonly insertAutofillContentService: InsertAutofillContentService;
  private sendCollectDetailsMessageTimeout: number | NodeJS.Timeout | undefined;
  private readonly extensionMessageHandlers: AutofillExtensionMessageHandlers = {
    collectPageDetails: ({ message }) => this.collectPageDetails(message),
    collectPageDetailsImmediately: ({ message }) => this.collectPageDetails(message, true),
    fillForm: ({ message }) => this.fillForm(message),
    openAutofillOverlay: ({ message }) => this.openAutofillOverlay(message),
    addNewVaultItemFromOverlay: () => this.addNewVaultItemFromOverlay(),
    redirectOverlayFocusOut: ({ message }) => this.redirectOverlayFocusOut(message),
    updateIsOverlayCiphersPopulated: ({ message }) => this.updateIsOverlayCiphersPopulated(message),
    bgUnlockPopoutOpened: () => this.blurAndRemoveOverlay(),
    bgVaultItemRepromptPopoutOpened: () => this.blurAndRemoveOverlay(),
    updateAutofillOverlayVisibility: ({ message }) => this.updateAutofillOverlayVisibility(message),
    getSubFrameOffsets: ({ message }) => this.getSubFrameOffsets(message),
    getSubFrameOffsetsThroughWindowMessaging: ({ message }) =>
      this.getSubFrameOffsetsThroughWindowMessaging(message),
  };

  /**
   * AutofillInit constructor. Initializes the DomElementVisibilityService,
   * CollectAutofillContentService and InsertAutofillContentService classes.
   *
   * @param autofillOverlayContentService - The autofill overlay content service, potentially undefined.
   * @param inlineMenuElements - The inline menu elements, potentially undefined.
   */
  constructor(
    autofillOverlayContentService?: AutofillOverlayContentService,
    inlineMenuElements?: InlineMenuElements,
  ) {
    this.autofillOverlayContentService = autofillOverlayContentService;
    if (this.autofillOverlayContentService) {
      this.extensionMessageHandlers = Object.assign(
        this.extensionMessageHandlers,
        this.autofillOverlayContentService.extensionMessageHandlers,
      );
    }

    this.inlineMenuElements = inlineMenuElements;
    if (this.inlineMenuElements) {
      this.extensionMessageHandlers = Object.assign(
        this.extensionMessageHandlers,
        this.inlineMenuElements.extensionMessageHandlers,
      );
    }

    this.domElementVisibilityService = new DomElementVisibilityService();
    this.collectAutofillContentService = new CollectAutofillContentService(
      this.domElementVisibilityService,
      this.autofillOverlayContentService,
    );
    this.insertAutofillContentService = new InsertAutofillContentService(
      this.domElementVisibilityService,
      this.collectAutofillContentService,
    );

    window.addEventListener("message", (event) => {
      // if (event.source !== window) {
      //   return;
      // }

      if (event.data.command === "calculateSubFramePositioning") {
        const subFrameData = event.data.subFrameData;
        let subFrameOffsets: SubFrameOffsetData;
        const iframes = document.querySelectorAll("iframe");
        for (let i = 0; i < iframes.length; i++) {
          if (iframes[i].contentWindow === event.source) {
            const iframeElement = iframes[i];
            subFrameOffsets = this.calculateSubFrameOffsets(
              iframeElement,
              subFrameData.url,
              subFrameData.frameId,
            );

            subFrameData.top += subFrameOffsets.top;
            subFrameData.left += subFrameOffsets.left;

            break;
          }
        }

        if (globalThis.window.self !== globalThis.window.top) {
          globalThis.parent.postMessage(
            { command: "calculateSubFramePositioning", subFrameData },
            "*",
          );
          return;
        }

        void sendExtensionMessage("updateSubFrameData", {
          subFrameData,
        });
      }
    });
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
      this.clearSendCollectDetailsMessageTimeout();
      this.sendCollectDetailsMessageTimeout = setTimeout(
        () => sendExtensionMessage("bgCollectPageDetails", { sender: "autofillInit" }),
        250,
      );
    };

    if (document.readyState === "complete") {
      sendCollectDetailsMessage();
    }

    window.addEventListener("load", sendCollectDetailsMessage);
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

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    chrome.runtime.sendMessage({
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
    await sendExtensionMessage("updateIsFieldCurrentlyFilling", { isFieldCurrentlyFilling: true });
    await this.insertAutofillContentService.fillForm(fillScript);

    if (!this.autofillOverlayContentService) {
      return;
    }

    setTimeout(
      () =>
        sendExtensionMessage("updateIsFieldCurrentlyFilling", { isFieldCurrentlyFilling: false }),
      250,
    );
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
    void sendExtensionMessage("closeAutofillOverlay");
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

  private async getSubFrameOffsets(
    message: AutofillExtensionMessage,
  ): Promise<SubFrameOffsetData | null> {
    const { subFrameUrl } = message;
    const subFrameUrlWithoutTrailingSlash = subFrameUrl?.replace(/\/$/, "");

    let iframeElement: HTMLIFrameElement | null = null;
    const iframeElements = document.querySelectorAll(
      `iframe[src="${subFrameUrl}"], iframe[src="${subFrameUrlWithoutTrailingSlash}"]`,
    ) as NodeListOf<HTMLIFrameElement>;
    if (iframeElements.length === 1) {
      iframeElement = iframeElements[0];
    }

    if (!iframeElement) {
      return null;
    }

    return this.calculateSubFrameOffsets(iframeElement, subFrameUrl);
  }

  private calculateSubFrameOffsets(
    iframeElement: HTMLIFrameElement,
    subFrameUrl?: string,
    frameId?: number,
  ): SubFrameOffsetData {
    const iframeRect = iframeElement.getBoundingClientRect();
    const iframeStyles = globalThis.getComputedStyle(iframeElement);
    const paddingLeft = parseInt(iframeStyles.getPropertyValue("padding-left"));
    const paddingTop = parseInt(iframeStyles.getPropertyValue("padding-top"));
    const borderWidthLeft = parseInt(iframeStyles.getPropertyValue("border-left-width"));
    const borderWidthTop = parseInt(iframeStyles.getPropertyValue("border-top-width"));

    return {
      url: subFrameUrl,
      frameId,
      top: iframeRect.top + paddingTop + borderWidthTop,
      left: iframeRect.left + paddingLeft + borderWidthLeft,
    };
  }

  private getSubFrameOffsetsThroughWindowMessaging(message: any) {
    globalThis.parent.postMessage(
      {
        command: "calculateSubFramePositioning",
        subFrameData: {
          url: window.location.href,
          frameId: message.subFrameId,
          left: 0,
          top: 0,
        },
      },
      "*",
    );
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

  private clearSendCollectDetailsMessageTimeout() {
    if (this.sendCollectDetailsMessageTimeout) {
      clearTimeout(this.sendCollectDetailsMessageTimeout as number);
    }
  }

  /**
   * Handles destroying the autofill init content script. Removes all
   * listeners, timeouts, and object instances to prevent memory leaks.
   */
  destroy() {
    chrome.runtime.onMessage.removeListener(this.handleExtensionMessage);
    this.collectAutofillContentService.destroy();
    this.autofillOverlayContentService?.destroy();
    this.inlineMenuElements?.destroy();
    this.clearSendCollectDetailsMessageTimeout();
  }
}

export default AutofillInit;
