import { inject, Injectable, signal } from "@angular/core";
import { Subject } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../../background/abstractions/overlay.background";
import { InlineMenuFillType } from "../../enums/autofill-overlay.enum";
import {
  InitAutofillInlineMenuListMessage,
  UpdateAutofillInlineMenuGeneratedPasswordMessage,
  UpdateAutofillInlineMenuListCiphersParams,
} from "../../overlay/inline-menu/abstractions/autofill-inline-menu-list";
import { InlineMenuPageChannel } from "../../overlay/inline-menu/pages/shared/inline-menu-page-channel";
import {
  AutofillPageI18nService,
  translationMapTranslate,
} from "../shared/autofill-page-i18n.service";
import { applyAutofillPageTheme } from "../shared/bootstrap-autofill-page";

import { InlineMenuListState, InlineMenuNewItemKind } from "./inline-menu.types";

/** How long a passkey sign-in shows the loader before the menu re-checks focus. */
const PASSKEY_AUTH_TIMEOUT_MS = 4000;

/**
 * The inline menu list page's connection to the extension, through the menu container.
 * Holds the list's view state and turns user actions into container messages.
 */
@Injectable()
export class InlineMenuListMessagingService {
  private readonly i18nService = inject(AutofillPageI18nService);
  private readonly channel = new InlineMenuPageChannel();

  private authStatus: AuthenticationStatus = AuthenticationStatus.Locked;
  private inlineMenuFillType: InlineMenuFillType = CipherType.Login;
  private showInlineMenuAccountCreation = false;
  private passkeyAuthInProgress = false;
  private initialized = false;

  private readonly _state = signal<InlineMenuListState | undefined>(undefined);
  readonly state = this._state.asReadonly();

  private readonly focusRequested = new Subject<void>();
  /** The background asked the list to take focus. */
  readonly focusRequested$ = this.focusRequested.asObservable();

  private readonly focusCheckRequested = new Subject<void>();
  /** The background asked whether the list still has focus. */
  readonly focusCheckRequested$ = this.focusCheckRequested.asObservable();

  constructor() {
    this.channel.listen({
      initAutofillInlineMenuList: ({ message }: { message: InitAutofillInlineMenuListMessage }) =>
        this.init(message),
      checkAutofillInlineMenuListFocused: () => this.initialized && this.focusCheckRequested.next(),
      updateAutofillInlineMenuListCiphers: ({
        message,
      }: {
        message: UpdateAutofillInlineMenuListCiphersParams;
      }) => this.updateCiphers(message),
      updateAutofillInlineMenuGeneratedPassword: ({
        message,
      }: {
        message: UpdateAutofillInlineMenuGeneratedPasswordMessage;
      }) => this.updateGeneratedPassword(message),
      showSaveLoginInlineMenuList: () => {
        if (this.authStatus === AuthenticationStatus.Unlocked) {
          this._state.set({ view: "saveLogin" });
        }
      },
      focusAutofillInlineMenuList: () => this.initialized && this.focusRequested.next(),
    });
  }

  unlock() {
    this.channel.post({ command: "unlockVault" });
  }

  addNewItem() {
    this.channel.post({
      command: "addNewVaultItem",
      addNewCipherType: this.showInlineMenuAccountCreation
        ? CipherType.Login
        : this.inlineMenuFillType,
    });
  }

  fillCipher(cipher: InlineMenuCipherData) {
    const usePasskey = !!cipher.login?.passkey;
    if (usePasskey) {
      this.passkeyAuthInProgress = true;
      this._state.set({ view: "authenticating" });
      globalThis.setTimeout(() => {
        this.passkeyAuthInProgress = false;
        this.channel.post({ command: "checkAutofillInlineMenuButtonFocused" });
      }, PASSKEY_AUTH_TIMEOUT_MS);
    }

    this.channel.post({
      command: "fillAutofillInlineMenuCipher",
      inlineMenuCipherId: cipher.id,
      usePasskey,
    });
  }

  viewCipher(cipher: InlineMenuCipherData) {
    this.channel.post({ command: "viewSelectedCipher", inlineMenuCipherId: cipher.id });
  }

  refreshCiphers() {
    this.channel.post({ command: "refreshOverlayCiphers" });
  }

  fillGeneratedPassword() {
    this.channel.post({ command: "fillGeneratedPassword" });
  }

  regeneratePassword() {
    this.channel.post({ command: "refreshGeneratedPassword" });
  }

  /** The list ran out of focus targets; let the background decide whether to close. */
  checkButtonFocused() {
    this.channel.post({ command: "checkAutofillInlineMenuButtonFocused" });
  }

  reportHeight(height: number) {
    this.channel.post({
      command: "updateAutofillInlineMenuListHeight",
      styles: { height: `${height}px` },
    });
  }

  private init(message: InitAutofillInlineMenuListMessage) {
    const {
      translations,
      theme,
      authStatus,
      ciphers = [],
      portKey,
      inlineMenuFillType = CipherType.Login,
      showInlineMenuAccountCreation = false,
      generatedPassword,
      showSaveLoginMenu,
    } = message;

    this.channel.setPortKey(portKey);
    this.i18nService.setTranslate(translationMapTranslate(translations));
    applyAutofillPageTheme(theme);

    this.authStatus = authStatus;
    this.inlineMenuFillType = inlineMenuFillType;
    this.initialized = true;

    if (authStatus !== AuthenticationStatus.Unlocked) {
      this._state.set({ view: "locked" });
      return;
    }

    if (showSaveLoginMenu) {
      this._state.set({ view: "saveLogin" });
      return;
    }

    if (generatedPassword) {
      this._state.set({ view: "passwordGenerator", password: generatedPassword });
      return;
    }

    this.updateCiphers({ ciphers, showInlineMenuAccountCreation });
  }

  private updateCiphers({
    ciphers = [],
    showInlineMenuAccountCreation = false,
  }: UpdateAutofillInlineMenuListCiphersParams) {
    if (this.passkeyAuthInProgress) {
      return;
    }

    this.showInlineMenuAccountCreation = showInlineMenuAccountCreation;
    const visibleCiphers = this.filterCiphersForTotpField(ciphers);

    if (!visibleCiphers.length) {
      this._state.set({ view: "noResults", newItemKind: this.newItemKind() });
      return;
    }

    this._state.set({
      view: "ciphers",
      ciphers: visibleCiphers,
      newItemKind: showInlineMenuAccountCreation ? "login" : undefined,
    });
  }

  private updateGeneratedPassword({
    generatedPassword,
  }: UpdateAutofillInlineMenuGeneratedPasswordMessage) {
    if (this.authStatus !== AuthenticationStatus.Unlocked || !generatedPassword) {
      return;
    }
    this._state.set({ view: "passwordGenerator", password: generatedPassword });
  }

  /** A TOTP field only offers ciphers that have a TOTP code. */
  private filterCiphersForTotpField(ciphers: InlineMenuCipherData[]) {
    const isTotpField =
      this.inlineMenuFillType === CipherType.Login &&
      ciphers.some((cipher) => cipher.login?.totpField);
    return isTotpField ? ciphers.filter((cipher) => cipher.login?.totp) : ciphers;
  }

  private newItemKind(): InlineMenuNewItemKind {
    if (this.inlineMenuFillType === CipherType.Login || this.showInlineMenuAccountCreation) {
      return "login";
    }
    if (this.inlineMenuFillType === CipherType.Card) {
      return "card";
    }
    if (this.inlineMenuFillType === CipherType.Identity) {
      return "identity";
    }
    return "item";
  }
}
