import { Injectable, computed, inject, signal } from "@angular/core";

import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { TwoFactorMethod } from "../../../../importers/keeper/access";
import { KEEPER_SSO_TAB_MONITOR } from "../../../keeper/services/keeper-sso-tab-monitor";

import { KeeperAuthSession, KeeperInlineStage } from "./keeper-auth-session";

export type { KeeperInlineStage } from "./keeper-auth-session";

// The key Keeper's client reports this failure by; the legacy dialog words it, the card words it
// again for the new design.
const UNSUPPORTED_TWO_FACTOR_KEY = "keeperUnsupported2faMethod";

/** A prompt the card can render. Loading and importing are busy states over a screen, not screens. */
export type KeeperInlineScreen = Exclude<
  KeeperInlineStage,
  { kind: "loading" } | { kind: "importing" }
>;

/** Shows Keeper's login prompts in the import card instead of the legacy dialog. It owns what the
 *  card displays; each login runs through its own `KeeperAuthSession`, and only the current
 *  session can change the display. */
@Injectable()
export class KeeperInlineAuthUi {
  private readonly ssoTabMonitor = inject(KEEPER_SSO_TAB_MONITOR);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly dialogService = inject(DialogService);

  // The extension captures the SSO token from the callback tab itself, so it never asks for it.
  private readonly autoCaptureSsoToken =
    inject(PlatformUtilsService).getClientType() === ClientType.Browser;

  private readonly _stage = signal<KeeperInlineStage>({ kind: "idle" });
  readonly stage = this._stage.asReadonly();

  // The screen stays up while a request is in flight; the Continue button shows the busy state.
  private readonly _screen = signal<KeeperInlineScreen>({ kind: "idle" });
  readonly screen = this._screen.asReadonly();

  /** A request is in flight, or the vault is being written. */
  readonly busy = computed(() => {
    const kind = this.stage().kind;
    return kind === "loading" || kind === "importing";
  });

  private current: KeeperAuthSession | undefined;
  private answerer: (() => void) | undefined;
  private startOver: (() => void) | undefined;

  /** The card header's subtitle for the screen showing; null keeps the default one. */
  readonly subtitleKey = computed<string | null>(() => {
    const stage = this.screen();
    switch (stage.kind) {
      case "selectApproval":
        return "keeperLoginApprovalMethodDesc";
      case "approvalCode":
        return stage.variant === "email" ? "keeperLoginEmailCodeDesc" : null;
      case "twoFactorCode":
        if (!stage.needsInput) {
          return null;
        }
        if (stage.hidden) {
          return "twoFactorCodePrompt";
        }
        switch (stage.method) {
          case TwoFactorMethod.Totp:
            return "keeperLoginAuthenticatorDesc";
          case TwoFactorMethod.Sms:
            return "keeperLoginSmsDesc";
          case TwoFactorMethod.KeeperDna:
            return "keeperDnaCodePrompt";
          default:
            return "twoFactorCodePrompt";
        }
      case "password":
        return "keeperLoginPasswordDesc";
      default:
        return null;
    }
  });

  // Leaving cancels a request that was already sent to the user's device.
  readonly leaveNeedsConfirm = computed(() => {
    const stage = this.stage();
    return stage.kind === "dnaPush" || (stage.kind === "approvalCode" && stage.variant === "push");
  });

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
    this._screen.set({ kind: "idle" });
    this._stage.set({ kind: "loading" });
    return session;
  }

  /** Ends `session`'s display. A superseded session can't blank the login that replaced it. */
  end(session: KeeperAuthSession): void {
    if (this.current === session) {
      this.setStage({ kind: "idle" });
    }
  }

  /** Cancels the login and clears the card at once; a request still in flight can't hold it busy. */
  leave(): void {
    const session = this.current;
    this.current = undefined;
    this.setStage({ kind: "idle" });
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

  /** The import controls register how to return to a fresh first page after a fatal login error. */
  registerStartOver(startOver: (() => void) | undefined): void {
    this.startOver = startOver;
  }

  confirmLeave(): Promise<boolean> {
    return this.dialogService.openSimpleDialog({
      title: { key: "cancelRequest" },
      content: { key: "keeperLoginCancelRequestDesc" },
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

  private create(): KeeperAuthSession {
    const session = new KeeperAuthSession(
      (shown, stage) => this.show(shown, stage),
      this.ssoTabMonitor,
      this.autoCaptureSsoToken,
      (failed, message) => this.reportError(failed, message),
    );
    this.current = session;
    return session;
  }

  private reportError(session: KeeperAuthSession, message: string): void {
    if (this.current !== session) {
      return;
    }
    const unsupportedTwoFactor = message === UNSUPPORTED_TWO_FACTOR_KEY;
    this.toastService.showToast({
      variant: "error",
      title: undefined,
      message: this.i18nService.t(
        unsupportedTwoFactor ? "keeperLoginUnsupportedTwoFactor" : message,
      ),
    });
    // The user can still switch methods or import manually, so they keep their email and server.
    if (!unsupportedTwoFactor) {
      this.startOver?.();
    }
  }

  private show(session: KeeperAuthSession, stage: KeeperInlineStage): void {
    if (this.current === session) {
      this.setStage(stage);
    }
  }

  private setStage(stage: KeeperInlineStage): void {
    this._stage.set(stage);
    if (stage.kind !== "loading" && stage.kind !== "importing") {
      this._screen.set(stage);
    }
  }
}
