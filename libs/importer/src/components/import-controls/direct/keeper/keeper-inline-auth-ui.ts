import { Injectable, computed, inject, signal } from "@angular/core";

import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { KEEPER_SSO_TAB_MONITOR } from "../../../keeper/services/keeper-sso-tab-monitor";

import { KeeperAuthSession, KeeperInlineStage } from "./keeper-auth-session";

export type { KeeperInlineStage } from "./keeper-auth-session";

/** Shows Keeper's login prompts in the import card instead of the legacy dialog. It owns what the
 *  card displays; each login runs through its own `KeeperAuthSession`, and only the current
 *  session can change the display. */
@Injectable()
export class KeeperInlineAuthUi {
  private readonly ssoTabMonitor = inject(KEEPER_SSO_TAB_MONITOR);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  // The extension captures the SSO token from the callback tab itself, so it never asks for it.
  private readonly autoCaptureSsoToken =
    inject(PlatformUtilsService).getClientType() === ClientType.Browser;

  private readonly _stage = signal<KeeperInlineStage>({ kind: "idle" });
  readonly stage = this._stage.asReadonly();

  private current: KeeperAuthSession | undefined;
  private answerer: (() => void) | undefined;

  readonly loginActive = computed(() => this.stage().kind !== "idle");

  // The vault is being written, so there is nothing left to cancel and no way to leave.
  readonly importing = computed(() => this.stage().kind === "importing");

  // The card is waiting on Keeper or an approver rather than the user, so Continue has no input.
  readonly waiting = computed(() => {
    const stage = this.stage();
    return (
      stage.kind === "loading" ||
      stage.kind === "importing" ||
      stage.kind === "duoPush" ||
      stage.kind === "dnaPush" ||
      (stage.kind === "approvalCode" && stage.variant !== "email")
    );
  });

  /** The login in progress. Created on first use for callers that skip `begin()`. */
  get session(): KeeperAuthSession {
    return this.current ?? this.create();
  }

  /** Starts a login, cancelling whichever one was still running. */
  begin(): KeeperAuthSession {
    this.current?.leave();
    const session = this.create();
    this._stage.set({ kind: "loading" });
    return session;
  }

  /** Ends `session`'s display. A superseded session can't blank the login that replaced it. */
  end(session: KeeperAuthSession): void {
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

  submit(value: unknown): void {
    this.current?.submit(value);
  }

  resend(): void {
    this.current?.resend();
    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("keeperLoginCodeResent"),
    });
  }

  dismissError(): void {
    this.current?.dismissError();
  }

  private create(): KeeperAuthSession {
    const session = new KeeperAuthSession(
      (shown, stage) => this.show(shown, stage),
      this.ssoTabMonitor,
      this.autoCaptureSsoToken,
    );
    this.current = session;
    return session;
  }

  private show(session: KeeperAuthSession, stage: KeeperInlineStage): void {
    if (this.current === session) {
      this._stage.set(stage);
    }
  }
}
