import { Injectable, computed, inject, signal } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { LASTPASS_IMPORT_PAGE_FOCUS } from "../../../lastpass/lastpass-import-page-focus";

import { LastPassAuthSession, LastPassInlineStage } from "./lastpass-auth-session";

export type { LastPassInlineStage } from "./lastpass-auth-session";

/** Shows LastPass's login prompts in the import card instead of dialogs. It owns what the card
 *  displays; each login runs through its own `LastPassAuthSession`, and only the current session
 *  can change the display. */
@Injectable()
export class LastPassInlineAuthUi {
  private readonly pageFocus = inject(LASTPASS_IMPORT_PAGE_FOCUS);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  private readonly _stage = signal<LastPassInlineStage>({ kind: "idle" });
  readonly stage = this._stage.asReadonly();

  private current: LastPassAuthSession | undefined;
  private answerer: (() => void) | undefined;
  private startOver: (() => void) | undefined;

  /** The card header's subtitle for the screen showing; null keeps the default one. */
  readonly subtitleKey = computed<string | null>(() => {
    switch (this.stage().kind) {
      case "password":
        return "lastPassLoginPasswordDesc";
      case "code":
        return "lastPassLoginCodeDesc";
      default:
        return null;
    }
  });

  readonly loginActive = computed(() => this.stage().kind !== "idle");

  // The vault is being written, so there is nothing left to cancel and no way to leave.
  readonly importing = computed(() => this.stage().kind === "importing");

  // The card is waiting on LastPass or the identity provider rather than the user, so Continue
  // has no input.
  readonly waiting = computed(() => {
    const kind = this.stage().kind;
    return kind === "loading" || kind === "importing" || kind === "sso";
  });

  /** The login in progress. Created on first use for callers that skip `begin()`. */
  get session(): LastPassAuthSession {
    return this.current ?? this.create();
  }

  /** Starts a login, cancelling whichever one was still running. */
  begin(): LastPassAuthSession {
    this.current?.leave();
    const session = this.create();
    this._stage.set({ kind: "loading" });
    return session;
  }

  /** Ends `session`'s display. A superseded session can't blank the login that replaced it. */
  end(session: LastPassAuthSession): void {
    if (this.current === session) {
      this._stage.set({ kind: "idle" });
    }
  }

  /** Cancels the login and clears the card at once; a request still in flight can't hold it busy. */
  leave(): void {
    const session = this.current;
    this.current = undefined;
    this._stage.set({ kind: "idle" });
    session?.leave();
  }

  /** The login card registers how to answer its current prompt from its own form. */
  registerAnswerer(answerer: (() => void) | undefined): void {
    this.answerer = answerer;
  }

  /** Answers the prompt that is showing; Continue lands here during a login. */
  answer(): void {
    this.answerer?.();
  }

  /** The import controls register how to return to a fresh first page after a failed login. */
  registerStartOver(startOver: (() => void) | undefined): void {
    this.startOver = startOver;
  }

  submit(value: string): void {
    this.current?.submit(value);
  }

  /** Shows a failure that no field can hold, then returns to a fresh first page. */
  fail(session: LastPassAuthSession, messageKey: string): void {
    if (this.current !== session) {
      return;
    }
    this.toastService.showToast({
      variant: "error",
      title: undefined,
      message: this.i18nService.t(messageKey),
    });
    this.startOver?.();
  }

  private create(): LastPassAuthSession {
    const session = new LastPassAuthSession(
      (shown, stage) => this.show(shown, stage),
      this.pageFocus,
    );
    this.current = session;
    return session;
  }

  private show(session: LastPassAuthSession, stage: LastPassInlineStage): void {
    if (this.current === session) {
      this._stage.set(stage);
    }
  }
}
