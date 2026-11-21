import { EVENTS } from "@bitwarden/common/autofill/constants";

import { RedirectFocusDirection } from "../../../../enums/autofill-overlay.enum";
import { EventSecurity } from "../../../../utils/event-security";
import {
  AutofillInlineMenuPageElementWindowMessage,
  AutofillInlineMenuPageElementWindowMessageHandlers,
} from "../../abstractions/autofill-inline-menu-page-element";

/**
 * The messaging protocol between an inline menu page (button or list) and the menu container
 * that hosts it: origin pinning, the token handshake, port key stamping, and the shared blur
 * and keyboard handling. Framework-agnostic so both the vanilla and Angular pages use it.
 */
export class InlineMenuPageChannel {
  private messageOrigin?: string;
  private token?: string;
  private portKey?: string;
  private handlers?: AutofillInlineMenuPageElementWindowMessageHandlers;

  /**
   * Starts listening for messages from the container and for page blur and keyboard events.
   */
  listen(handlers: AutofillInlineMenuPageElementWindowMessageHandlers) {
    this.handlers = handlers;

    globalThis.addEventListener(EVENTS.MESSAGE, this.handleWindowMessage);
    globalThis.addEventListener(EVENTS.BLUR, this.handleWindowBlurEvent);
    globalThis.document.addEventListener(EVENTS.KEYDOWN, this.handleDocumentKeyDownEvent);
  }

  /** Background generated key that allows the port to communicate with the background. */
  setPortKey(portKey: string) {
    this.portKey = portKey;
  }

  /**
   * Posts a window message to the parent window.
   */
  post(message: AutofillInlineMenuPageElementWindowMessage) {
    // never send messages containing authentication tokens without a valid token and an established messageOrigin
    if (!this.token || !this.messageOrigin) {
      return;
    }
    const messageWithAuth: Record<string, unknown> = {
      portKey: this.portKey,
      ...message,
      token: this.token,
    };
    globalThis.parent.postMessage(messageWithAuth, this.messageOrigin);
  }

  private handleWindowMessage = (event: MessageEvent) => {
    if (!this.handlers) {
      return;
    }

    if (event.source !== globalThis.parent) {
      return;
    }

    if (!this.messageOrigin) {
      this.messageOrigin = event.origin;
    }

    if (event.origin !== this.messageOrigin) {
      return;
    }

    const message = event?.data;

    if (!message?.command) {
      return;
    }

    const isInitCommand =
      message.command === "initAutofillInlineMenuButton" ||
      message.command === "initAutofillInlineMenuList";

    if (isInitCommand) {
      if (!message?.token) {
        return;
      }
      this.token = message.token;
    } else {
      if (!this.token || !message?.token || message.token !== this.token) {
        return;
      }
    }

    const handler = this.handlers[message?.command];
    if (!handler) {
      return;
    }

    handler({ message });
  };

  private handleWindowBlurEvent = () => {
    this.post({ command: "autofillInlineMenuBlurred" });
  };

  /**
   * Facilitates redirecting the user focus in the right direction out of the inline menu. Also
   * facilitates closing the inline menu when the user presses the Escape key.
   */
  private handleDocumentKeyDownEvent = (event: KeyboardEvent) => {
    const listenedForKeys = new Set(["Tab", "Escape", "ArrowUp", "ArrowDown"]);
    /**
     * Reject synthetic events (not originating from the user agent)
     */
    if (!EventSecurity.isEventTrusted(event) || !listenedForKeys.has(event.code)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.code === "Tab") {
      this.sendRedirectFocusOutMessage(
        event.shiftKey ? RedirectFocusDirection.Previous : RedirectFocusDirection.Next,
      );
      return;
    }

    if (event.code === "Escape") {
      this.sendRedirectFocusOutMessage(RedirectFocusDirection.Current);
    }
  };

  private sendRedirectFocusOutMessage(direction: string) {
    this.post({ command: "redirectAutofillInlineMenuFocusOut", direction });
  }
}
