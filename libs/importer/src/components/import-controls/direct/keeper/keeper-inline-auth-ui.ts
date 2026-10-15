import { Injectable, computed, inject, signal } from "@angular/core";

import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { KEEPER_SSO_TAB_MONITOR } from "../../../keeper/services/keeper-sso-tab-monitor";

import { KeeperAuthSession, KeeperInlineStage } from "./keeper-auth-session";

export type { KeeperInlineStage } from "./keeper-auth-session";

/** Shows Keeper's login prompts in the import card instead of the legacy dialog. It owns what the
 *  card displays; each login runs through its own `KeeperAuthSession`, and only the current
 *  session can change the display. */
@Injectable()
export class KeeperInlineAuthUi {
  private readonly ssoTabMonitor = inject(KEEPER_SSO_TAB_MONITOR);
  private readonly dialogService = inject(DialogService);
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

  /** Whether Back can return to a method picker instead of leaving: only where Keeper offered a
   *  choice, since with one method the client would silently pick and re-send the same one. */
  readonly canStepBack = computed(() => {
    const stage = this.stage();
    const session = this.current;
    if (session === undefined) {
      return false;
    }
    switch (stage.kind) {
      case "approvalCode":
        return session.approvalMethodCount > 1;
      case "twoFactorCode":
        return stage.hidden ? session.approvalMethodCount > 1 : session.twoFactorMethodCount > 1;
      case "duoPush":
      case "dnaPush":
        return session.twoFactorMethodCount > 1;
      default:
        return false;
    }
  });

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

  leave(): void {
    this.current?.leave();
  }

  /** The login card registers how to answer its current prompt from its own form. */
  registerAnswerer(answerer: (() => void) | undefined): void {
    this.answerer = answerer;
  }

  /** Answers the prompt that is showing; Continue lands here during a login. */
  answer(): void {
    this.answerer?.();
  }

  /** Cancels the login, first confirming when that would cancel a pending admin approval request.
   *  Resolves false if the user chose to stay. */
  async leaveWithConfirm(): Promise<boolean> {
    if (!(await this.confirmLeaving())) {
      return false;
    }
    this.leave();
    return true;
  }

  /** Back from a method's own screen returns to the picker so another method can be chosen.
   *  False when there is no picker to return to. */
  async stepBack(): Promise<boolean> {
    if (!this.canStepBack()) {
      return false;
    }
    if (await this.confirmLeaving()) {
      this.tryAnother();
    }
    return true;
  }

  private async confirmLeaving(): Promise<boolean> {
    const stage = this.stage();
    if (stage.kind !== "approvalCode" || stage.variant !== "admin") {
      return true;
    }
    return this.dialogService.openSimpleDialog({
      title: { key: "approvalRequestWillBeCanceled" },
      content: { key: "pendingApprovalCancelConfirmation" },
      acceptButtonText: { key: "cancelRequest" },
      cancelButtonText: { key: "close" },
      type: "danger",
    });
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

  tryAnother(): void {
    this.current?.tryAnother();
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
