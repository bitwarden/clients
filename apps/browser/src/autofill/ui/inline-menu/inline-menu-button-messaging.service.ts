import { inject, Injectable, signal } from "@angular/core";
import { Subject } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import {
  InitAutofillInlineMenuButtonMessage,
  UpdateAuthStatusMessage,
} from "../../overlay/inline-menu/abstractions/autofill-inline-menu-button";
import { InlineMenuPageChannel } from "../../overlay/inline-menu/pages/shared/inline-menu-page-channel";
import {
  AutofillPageI18nService,
  translationMapTranslate,
} from "../shared/autofill-page-i18n.service";

/**
 * The inline menu button page's connection to the extension, through the menu container.
 */
@Injectable()
export class InlineMenuButtonMessagingService {
  private readonly i18nService = inject(AutofillPageI18nService);
  private readonly channel = new InlineMenuPageChannel();

  private readonly _initialized = signal(false);
  readonly initialized = this._initialized.asReadonly();

  private readonly _unlocked = signal(false);
  readonly unlocked = this._unlocked.asReadonly();

  private readonly focusCheckRequested = new Subject<void>();
  /** The background asked whether the button still has focus. */
  readonly focusCheckRequested$ = this.focusCheckRequested.asObservable();

  constructor() {
    this.channel.listen({
      initAutofillInlineMenuButton: ({
        message,
      }: {
        message: InitAutofillInlineMenuButtonMessage;
      }) => this.init(message),
      checkAutofillInlineMenuButtonFocused: () => this.focusCheckRequested.next(),
      updateAutofillInlineMenuButtonAuthStatus: ({
        message,
      }: {
        message: UpdateAuthStatusMessage;
      }) => this._unlocked.set(message.authStatus === AuthenticationStatus.Unlocked),
    });
  }

  toggle() {
    this.channel.post({ command: "autofillInlineMenuButtonClicked" });
  }

  /** The button lost focus; let the background close the menu after its delay. */
  requestDelayedClosure() {
    this.channel.post({ command: "triggerDelayedAutofillInlineMenuClosure" });
  }

  private init({ translations, portKey, authStatus }: InitAutofillInlineMenuButtonMessage) {
    this.channel.setPortKey(portKey);
    this.i18nService.setTranslate(translationMapTranslate(translations));
    this._unlocked.set(authStatus === AuthenticationStatus.Unlocked);
    this._initialized.set(true);
  }
}
