import { Router } from "@angular/router";
import {
  BehaviorSubject,
  filter,
  firstValueFrom,
  fromEvent,
  merge,
  MonoTypeOperatorFunction,
  Subject,
  switchMap,
  take,
  throwError,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { PasswordRepromptService } from "@bitwarden/vault";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

import { UserVerificationCanceled } from "./desktop-fido2-user-verification.service.abstraction";

/**
 * Everything a ceremony needs to know about the windows involved in a request,
 * independent of what kind of credential is being filled: where to position our
 * own UI, and which native windows an OS prompt can attach itself to.
 *
 * Credential-specific flows extend this — see `NativeWindowObject` in
 * {@link ./desktop-fido2-user-interface.service} for the FIDO2 shape.
 */
export type AutofillWindowObject = {
  /**
   * The position of the client window.
   */
  windowXy: { x: number; y: number };

  /**
   * The native handle of the client window.
   */
  clientWindowHandle: Uint8Array | null;

  /**
   * The native handle of the Bitwarden app window, or null if the app has no
   * window at the time of the request.
   */
  appWindowHandle: Uint8Array | null;

  /**
   * OS-specific request context required for calls back to the OS during the
   * ceremony.
   */
  requestContext: string;
};

/**
 * RxJS operator that mirrors the source but errors with the signal's abort
 * `reason` if `signal` fires before the source settles, unsubscribing the
 * source (and any timers it holds, e.g. `timeout`) immediately.
 *
 * Because the abort side never completes on its own, consume the piped stream
 * with `firstValueFrom` (not `lastValueFrom`): the sources used here emit a
 * single value, so the first emission both resolves the caller and tears the
 * abort listener down.
 *
 * This does not fire for an already-aborted signal; guard the entry of the
 * calling API with `signal.throwIfAborted()`.
 *
 * TODO: If a second client needs this, promote it to a shared RxJS utility in
 * `libs/common`.
 */
export function throwOnAbort<T>(signal: AbortSignal): MonoTypeOperatorFunction<T> {
  return (source) =>
    merge(
      source,
      fromEvent(signal, "abort").pipe(switchMap(() => throwError(() => signal.reason))),
    );
}

/**
 * The flow-agnostic half of a desktop autofill ceremony: taking over the app
 * window to show modal UI, unlocking the vault, letting the user pick a cipher,
 * and enforcing a master-password reprompt on whatever they picked.
 *
 * FIDO2 extends this — see `DesktopFido2UserInterfaceSession` — layering
 * relying-party semantics and OS user verification on top.
 *
 * One session exists per in-flight native request, and the session that is
 * currently on screen is reachable through {@link DesktopAutofillUiService}.
 */
export class DesktopAutofillUiSession<TWindow extends AutofillWindowObject = AutofillWindowObject> {
  constructor(
    protected authService: AuthService,
    protected accountService: AccountService,
    protected logService: LogService,
    protected router: Router,
    protected desktopSettingsService: DesktopSettingsService,
    protected abortController: AbortController,
    protected windowObject: TWindow,
    protected passwordRepromptService: PasswordRepromptService,
  ) {}

  /** Prefix for this session's log lines, so subclasses stay distinguishable. */
  protected readonly logPrefix: string = "[DesktopAutofillUiSession]";

  /**
   * Whether the user unlocked their vault as part of this ceremony. Unlocking
   * already verifies the user, so the OS is not asked to do it a second time.
   */
  protected vaultUnlockedDuringCeremony: boolean = false;

  private availableCipherIdsSubject = new BehaviorSubject<string[]>([""]);
  /**
   * Observable that emits available cipher IDs once they're confirmed by the UI
   */
  availableCipherIds$ = this.availableCipherIdsSubject.pipe(
    filter((ids) => ids != null),
    take(1),
  );

  private chosenCipherSubject = new Subject<CipherViewLike | undefined>();

  /**
   * Whether this ceremony took over the app window to show UI. Some ceremonies
   * complete without any UI at all, and those must leave a window the user
   * already had open untouched.
   */
  protected uiShown = false;

  /**
   * Puts the picker on screen for `cipherIds` and resolves with the user's
   * choice. Callers own both verification of that choice and the {@link hideUi}
   * that tears the picker back down.
   */
  protected async selectCipher(
    cipherIds: string[],
    route: string,
  ): Promise<CipherViewLike | undefined> {
    this.publishAvailableCipherIds(cipherIds);

    await this.showUi(route, this.windowObject.windowXy, false);

    const chosenCipherTimeout = AbortSignal.timeout(60 * 1000);
    const chosenCipher = await this.waitForUiChosenCipher({
      signal: AbortSignal.any([this.abortController.signal, chosenCipherTimeout]),
    });
    this.logService.debug("Received chosen cipher", chosenCipher?.id);

    return chosenCipher;
  }

  /**
   * Makes the ciphers this ceremony offers available to whichever component is
   * about to be routed to.
   *
   * Call this *before* {@link showUi}: `availableCipherIds$` replays only a
   * single emission, and a subscriber that arrives first would take the
   * subject's placeholder seed instead. The routed component can't get ahead of
   * us because it isn't constructed until the navigation `showUi` performs.
   */
  protected publishAvailableCipherIds(cipherIds: string[]): void {
    this.availableCipherIdsSubject.next(cipherIds);
  }

  confirmChosenCipher(cipher?: CipherViewLike): void {
    this.chosenCipherSubject.next(cipher);
    this.chosenCipherSubject.complete();
  }

  /**
   * Called by the UI when the user dismisses the modal, so every waiter in the
   * ceremony resolves instead of hanging until its deadline.
   */
  cancel(): void {
    this.confirmChosenCipher(undefined);
  }

  protected async waitForUiChosenCipher({
    signal,
  }: {
    signal: AbortSignal;
  }): Promise<CipherViewLike | undefined> {
    try {
      signal.throwIfAborted();
      return await firstValueFrom(this.chosenCipherSubject.pipe(throwOnAbort(signal)));
    } catch (error) {
      // If the request is cancelled or timed out, return undefined instead of throwing
      // We should update pickCredential() to use allow returning undefined or
      // throw a specific error when we cancel.
      if (signal.reason instanceof DOMException && signal.reason.name === "TimeoutError") {
        this.logService.warning("Timeout: User did not select a cipher within the allowed time");
      } else if (signal.aborted) {
        this.logService.warning("Request was cancelled before the user selected a cipher", error);
      }
      return undefined;
    }
  }

  /**
   * Returns the app to the state it was in before this ceremony showed any UI,
   * leaving a window the user already had open untouched when no UI was shown.
   *
   * Ceremonies that wait for a result call this from their own `finally`.
   * Ceremonies that return as soon as a message is on screen don't: the
   * component showing that message calls this when the user dismisses it. Safe
   * to call more than once.
   */
  async hideUi(): Promise<void> {
    // Always clear modal mode so the app can never get stuck in it. The main
    // process only restyles the window on the modal -> standard transition, so
    // this is inert when the ceremony never entered modal mode.
    await this.desktopSettingsService.setModalMode(false);

    // The ceremony completed without showing UI, so there is nothing of ours to
    // tear down. The user may have had a window open the whole time; leave it
    // where they left it.
    if (!this.uiShown) {
      return;
    }

    // Reset to standard UI.
    await this.accountService.setShowHeader(true);
    await this.router.navigate(["/"]);
  }

  protected async showUi(
    route: string,
    position?: { x: number; y: number },
    showTrafficButtons: boolean = false,
    disableRedirect?: boolean,
  ): Promise<void> {
    // Load the UI:
    await this.desktopSettingsService.setModalMode(true, showTrafficButtons, position);
    await this.accountService.setShowHeader(showTrafficButtons);
    await this.router.navigate([
      route,
      {
        "disable-redirect": disableRedirect || null,
      },
    ]);
    this.uiShown = true;
  }

  async ensureUnlockedVault(): Promise<void> {
    this.logService.debug("ensureUnlockedVault");

    const status = await firstValueFrom(this.authService.activeAccountStatus$);
    if (status !== AuthenticationStatus.Unlocked) {
      const { signal } = this.abortController;
      let status2: AuthenticationStatus;
      try {
        signal.throwIfAborted();
        await this.showUi("/lock", this.windowObject.windowXy, true, true);
        const unlockTimeout = AbortSignal.timeout(1000 * 60 * 5); // 5 minutes
        status2 = await this.waitForVaultUnlock({
          signal: AbortSignal.any([signal, unlockTimeout]),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "TimeoutError") {
          this.logService.warning("Timeout: Vault was not unlocked within the allowed time");
        } else if (signal.aborted) {
          this.logService.warning("Request was cancelled before the vault was unlocked");
        } else {
          this.logService.warning("Error while waiting for vault to unlock", error);
        }
        await this.hideUi();
        throw new Error("Could not retrieve vault unlock status");
      }

      if (status2 !== AuthenticationStatus.Unlocked) {
        await this.hideUi();
        throw new Error("Vault is not unlocked");
      }

      // The user authenticated to Bitwarden to get here, which satisfies user
      // verification for the rest of this ceremony.
      this.vaultUnlockedDuringCeremony = true;
      // TODO: Navigate straight to the next modal screen instead of home. The
      // caller shows its own route immediately afterwards, so routing through
      // "/" flashes the main vault screen in between.
      await this.router.navigate(["/"]);
    }
  }

  /**
   * Waits for the vault to become unlocked, rejecting if the request is aborted
   * (with the abort `reason`).
   */
  private waitForVaultUnlock({ signal }: { signal: AbortSignal }): Promise<AuthenticationStatus> {
    signal.throwIfAborted();
    return firstValueFrom(
      this.authService.activeAccountStatus$.pipe(
        filter((s) => s === AuthenticationStatus.Unlocked),
        throwOnAbort(signal),
      ),
    );
  }

  /**
   * Satisfies user verification with the cipher's master-password reprompt when
   * it has one.
   *
   * The reprompt is checked before any other shortcut because unlocking the
   * vault may have used a method other than the master password (PIN,
   * biometrics), which does not satisfy a master-password reprompt.
   *
   * @returns `true` when the reprompt verified the user, `false` when the cipher
   * has no reprompt and verification must be established some other way.
   * @throws {UserVerificationCanceled} if the user dismissed the reprompt.
   */
  protected async verifyReprompt(cipher: CipherViewLike | undefined): Promise<boolean> {
    const repromptType = cipher?.reprompt ?? CipherRepromptType.None;
    switch (repromptType) {
      case CipherRepromptType.None:
        return false;
      case CipherRepromptType.Password:
        // TODO: Elide this prompt when the vault was unlocked with the master
        // password during this ceremony, since that already satisfies the reprompt.
        if (!(await this.passwordRepromptService.enabled())) {
          // An account with no master password can't be reprompted for one, so
          // the flag is inert — `PasswordRepromptService.showPasswordPrompt`
          // reports success without prompting for exactly this reason. Treat the
          // cipher as unprotected and verify by the usual means, rather than
          // reporting a verification that never happened.
          return false;
        }
        if (!(await this.passwordRepromptService.showPasswordPrompt())) {
          throw new UserVerificationCanceled();
        }
        return true;
      default:
        // The user deliberately protected this cipher with a method this build
        // doesn't recognize. Refuse the ceremony rather than substituting a
        // different check or letting it through unverified.
        this.logService.error(
          this.logPrefix,
          `Refusing to use a cipher protected by unrecognized reprompt type ${repromptType}`,
        );
        throw this.unrecognizedRepromptError();
    }
  }

  /**
   * The error reported when a cipher carries a reprompt type this build doesn't
   * recognize. Subclasses substitute whatever their caller expects.
   */
  protected unrecognizedRepromptError(): unknown {
    return new Error("Cipher is protected by an unrecognized reprompt type");
  }

  async close() {
    this.logService.debug("close");
  }
}

/**
 * Holds the autofill session that currently owns the app window, so the routed
 * modal components can reach it.
 */
export class DesktopAutofillUiService {
  private currentSession?: DesktopAutofillUiSession<AutofillWindowObject>;

  getCurrentSession(): DesktopAutofillUiSession<AutofillWindowObject> | undefined {
    return this.currentSession;
  }

  /** Registers the session that owns the app window. */
  setCurrentSession(session: DesktopAutofillUiSession<AutofillWindowObject>): void {
    this.currentSession = session;
  }
}
