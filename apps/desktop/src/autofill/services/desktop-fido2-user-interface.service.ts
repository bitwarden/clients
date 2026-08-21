import { Router } from "@angular/router";
import {
  firstValueFrom,
  map,
  Subject,
  filter,
  take,
  BehaviorSubject,
  fromEvent,
  merge,
  switchMap,
  throwError,
  MonoTypeOperatorFunction,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  Fido2AuthenticatorError,
  Fido2AuthenticatorErrorCode,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-authenticator.service.abstraction";
import {
  Fido2UserInterfaceService as Fido2UserInterfaceServiceAbstraction,
  Fido2UserInterfaceSession,
  NewCredentialParams,
  PickCredentialParams,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-user-interface.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType, SecureNoteType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { PasswordRepromptService } from "@bitwarden/vault";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

import {
  DesktopFido2UserVerificationService,
  Fido2UserVerificationOperation,
  UserVerificationCanceled,
} from "./desktop-fido2-user-verification.service.abstraction";

/**
 * This type is used to pass the window position from the native UI
 */
export type NativeWindowObject = {
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
   * authentication ceremony.
   */
  requestContext: string;

  /**
   * RP ID of the request.
   */
  rpId: string;

  /**
   * User handle for the credential. Absent for discoverable credential
   * requests, which don't contain a userHandle.
   */
  userHandle?: number[];
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
function throwOnAbort<T>(signal: AbortSignal): MonoTypeOperatorFunction<T> {
  return (source) =>
    merge(
      source,
      fromEvent(signal, "abort").pipe(switchMap(() => throwError(() => signal.reason))),
    );
}

export class DesktopFido2UserInterfaceService implements Fido2UserInterfaceServiceAbstraction<NativeWindowObject> {
  constructor(
    private authService: AuthService,
    private cipherService: CipherService,
    private accountService: AccountService,
    private logService: LogService,
    private messagingService: MessagingService,
    private router: Router,
    private desktopSettingsService: DesktopSettingsService,
    private userVerificationService: DesktopFido2UserVerificationService,
    private passwordRepromptService: PasswordRepromptService,
    private domainSettingsService: DomainSettingsService,
  ) {}
  private currentSession: any;

  getCurrentSession(): DesktopFido2UserInterfaceSession | undefined {
    return this.currentSession;
  }

  async newSession(
    fallbackSupported: boolean,
    nativeWindowObject: NativeWindowObject,
    abortController?: AbortController,
  ): Promise<DesktopFido2UserInterfaceSession> {
    this.logService.debug("newSession", fallbackSupported, abortController, nativeWindowObject);
    // Every entrypoint from DesktopAutofillService passes an AbortController.
    // If we don't do that, throw an error. This can't be caught at the type
    // system; we should consider updating the abstraction to require an
    // AbortController.
    if (!abortController) {
      throw new Error("No AbortController passed to desktop");
    }
    const session = new DesktopFido2UserInterfaceSession(
      this.authService,
      this.cipherService,
      this.accountService,
      this.logService,
      this.router,
      this.desktopSettingsService,
      abortController,
      nativeWindowObject,
      this.userVerificationService,
      this.passwordRepromptService,
      this.domainSettingsService,
    );

    this.currentSession = session;
    return session;
  }
}

export class DesktopFido2UserInterfaceSession implements Fido2UserInterfaceSession {
  constructor(
    private authService: AuthService,
    private cipherService: CipherService,
    private accountService: AccountService,
    private logService: LogService,
    private router: Router,
    private desktopSettingsService: DesktopSettingsService,
    private abortController: AbortController,
    private windowObject: NativeWindowObject,
    private userVerificationService: DesktopFido2UserVerificationService,
    private passwordRepromptService: PasswordRepromptService,
    private domainSettingsService: DomainSettingsService,
  ) {}

  private confirmCredentialSubject = new Subject<boolean>();

  private updatedCipher: CipherView | undefined = undefined;

  /**
   * Whether the user unlocked their vault as part of this ceremony. Unlocking
   * already verifies the user, so the OS is not asked to do it a second time.
   */
  private vaultUnlockedDuringCeremony: boolean = false;
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
  private uiShown = false;

  // Method implementation
  async pickCredential(
    params: PickCredentialParams,
  ): Promise<{ cipherId: string | undefined; userVerified: boolean }> {
    this.logService.debug("pickCredential desktop function", params);

    try {
      const abortSignal = this.abortController.signal;
      if (abortSignal.aborted) {
        this.logService.warning(
          "[DesktopFido2UserInterfaceSession]",
          "Request was cancelled before a credential was selected",
        );
        return { cipherId: undefined, userVerified: false };
      }

      // Check if we can return the credential without user interaction
      const response = await this.tryWithoutUserInteraction(params, {
        signal: abortSignal,
      });
      if (response) {
        return response;
      }

      this.logService.debug("Could not shortcut, showing UI");

      // make the cipherIds available to the UI.
      this.availableCipherIdsSubject.next(params.cipherIds);

      await this.showUi("/fido2-assertion", this.windowObject.windowXy, false);

      // TODO: Extend this to the deadline indicated by the timeout on the WebAuthn request.
      const chosenCipherTimeout = AbortSignal.timeout(60 * 1000);
      const chosenCipher = await this.waitForUiChosenCipher({
        signal: AbortSignal.any([abortSignal, chosenCipherTimeout]),
      });
      this.logService.debug("Received chosen cipher", chosenCipher?.id);

      if (!chosenCipher) {
        return { cipherId: undefined, userVerified: false };
      }

      const username = fido2UserNameFromCipher(chosenCipher);
      const userVerified = await this.verifyUser(
        "assertion",
        username,
        params.userVerification,
        chosenCipher,
        { signal: abortSignal },
      );

      return { cipherId: chosenCipher.id?.toString(), userVerified };
    } catch (error) {
      throw this.mapUserVerificationCancellation(error);
    } finally {
      // Make sure to clean up so the app is never stuck in modal mode
      await this.hideUi();
    }
  }

  get rpId(): string {
    return this.windowObject.rpId;
  }

  get userHandle(): number[] | undefined {
    return this.windowObject.userHandle;
  }

  confirmChosenCipher(cipher?: CipherViewLike): void {
    this.chosenCipherSubject.next(cipher);
    this.chosenCipherSubject.complete();
  }

  /**
   * Attempts to satisfy user verification without prompting the Bitwarden
   * app UI. OS user verification dialogs still may appear.
   *
   * @param params Parameters for the assertion flow.
   * @param options Includes a signal to cancel the UI flow.
   * @returns The selected cipherId and user verification result, or `undefined` if UI was required.
   */
  private async tryWithoutUserInteraction(
    params: PickCredentialParams,
    { signal }: { signal: AbortSignal },
  ): Promise<{ cipherId: string; userVerified: boolean } | undefined> {
    signal.throwIfAborted();

    const canRetrieveSilently =
      params.cipherIds.length === 1 && !params.masterPasswordRepromptRequired;
    if (!canRetrieveSilently) {
      return undefined;
    }

    const selectedCipherId = params.cipherIds[0];
    const needsUserVerification = params.userVerification;

    if (needsUserVerification) {
      // retrieve the cipher from the active account
      const activeUserId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );

      if (!activeUserId) {
        return;
      }
      const cipherView = await firstValueFrom(
        this.cipherService.cipherListViews$(activeUserId).pipe(
          map((ciphers) => {
            return ciphers.find((cipher) => cipher.id == selectedCipherId && !cipher.deletedDate);
          }),
          throwOnAbort(signal),
        ),
      );

      if (!cipherView) {
        this.logService.warning(
          "[DesktopFido2UserInterfaceSession]",
          `Could not find an active cipher for ID: ${selectedCipherId}`,
        );
        return undefined;
      }

      // Reprompts require showing Bitwarden UI, so stop if we detect that.
      if (cipherView.reprompt !== CipherRepromptType.None) {
        return undefined;
      }

      const username = fido2UserNameFromCipher(cipherView);

      // Prompt the user to verify themselves. An OS user verification dialog
      // may be shown, or if the user unlocked their vault during the ceremony,
      // this should succeed without further prompts.
      try {
        const userVerified = await this.verifyUser(
          "assertion",
          username,
          params.userVerification,
          cipherView,
          { signal },
        );
        const response = { cipherId: selectedCipherId, userVerified };
        this.logService.debug(
          "[DesktopFido2UserInterfaceSession]",
          "tryWithoutUserInteraction() succeeded",
          response,
        );
        return response;
      } catch (error) {
        // A dismissed prompt or a cipher we refuse to use ends the ceremony
        // outright; only a recoverable failure falls back to the picker.
        if (error instanceof UserVerificationCanceled || error instanceof Fido2AuthenticatorError) {
          throw error;
        }
        // Fall back to showing the picker, which offers the user another way
        // through the ceremony.
        this.logService.debug(
          "[DesktopFido2UserInterfaceSession]",
          "Failed to prompt for user verification without showing UI",
          error,
        );
        return undefined;
      }
    } else if (params.assumeUserPresence) {
      // If user verification is not required by the RP, and the user did some
      // selection in the OS dialog, we use that interaction as satisfying user
      // presence, and continue with UV = false.
      this.logService.debug(
        "[DesktopFido2UserInterfaceSession]",
        "shortcut - Assuming user presence and returning cipherId",
        selectedCipherId,
      );
      return { cipherId: selectedCipherId, userVerified: false };
    }
  }

  private async waitForUiChosenCipher({
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
   * Notifies the Fido2UserInterfaceSession that the UI operations has completed and it can return to the OS.
   */
  notifyConfirmCreateCredential(confirmed: boolean, updatedCipher?: CipherView): void {
    if (updatedCipher) {
      this.updatedCipher = updatedCipher;
    }
    this.confirmCredentialSubject.next(confirmed);
    this.confirmCredentialSubject.complete();
  }

  /**
   * Returns once the UI has confirmed and completed the operation
   * @returns
   */
  private async waitForUiNewCredentialConfirmation({
    signal,
  }: {
    signal: AbortSignal;
  }): Promise<boolean> {
    try {
      signal.throwIfAborted();
      return await firstValueFrom(this.confirmCredentialSubject.pipe(throwOnAbort(signal)));
    } catch (error) {
      if (signal.aborted) {
        this.logService.warning("Request was cancelled before the user confirmed a cipher");
      } else {
        this.logService.error("Error occurred while waiting for user confirmation", error);
      }

      // On cancellation or error, return false instead of throwing
      return false;
    }
  }

  /**
   * This is called by the OS. It loads the UI and waits for the user to confirm the new credential. Once the UI has confirmed, it returns to the the OS.
   * @param param0
   * @returns
   */
  async confirmNewCredential({
    credentialName,
    userName,
    userHandle,
    userVerification: needsUserVerification,
    rpId,
  }: NewCredentialParams): Promise<{
    cipherId: string | undefined;
    userVerified: boolean;
  }> {
    this.logService.debug(
      "confirmNewCredential",
      credentialName,
      userName,
      userHandle,
      needsUserVerification,
      rpId,
    );

    const abortSignal = this.abortController.signal;
    try {
      abortSignal.throwIfAborted();

      // The picker only exists to let the user add this passkey to an existing
      // login (or overwrite one). When nothing matches, there's no such choice
      // to make and the OS has already confirmed the user's intent to create the
      // passkey, so skip our UI and go straight to verification and creation.
      if ((await this.getMatchingLogins()).length > 0) {
        await this.showUi("/fido2-creation", this.windowObject.windowXy, false);

        // Wait for the UI to wrap up
        const confirmation = await this.waitForUiNewCredentialConfirmation({
          signal: abortSignal,
        });
        if (!confirmation) {
          return { cipherId: undefined, userVerified: false };
        }
      }

      // Confirming in our own UI establishes user presence, so we only verify
      // when the relying party asked for it or the chosen cipher requires a
      // master-password reprompt. `verifyUser` decides which prompt to show.
      const operation = this.updatedCipher ? "overwrite" : "registration";
      const userVerified = await this.verifyUser(
        operation,
        userName,
        needsUserVerification,
        this.updatedCipher,
        { signal: abortSignal },
      );

      // Abort before persisting anything so a failed verification never leaves a
      // dangling cipher or an unwanted overwrite.
      const repromptRequired =
        this.updatedCipher && this.updatedCipher.reprompt !== CipherRepromptType.None;
      const verificationExpected = needsUserVerification || repromptRequired;
      if (verificationExpected && !userVerified) {
        this.logService.warning(
          "[DesktopFido2UserInterfaceSession]",
          "Aborting credential creation because user verification was unsuccessful",
        );
        return { cipherId: undefined, userVerified: false };
      }

      if (this.updatedCipher) {
        await this.updateCredential(this.updatedCipher);
        return { cipherId: this.updatedCipher.id, userVerified };
      } else {
        // Create the cipher
        const createdCipher = await this.createCipher({
          credentialName,
          userName,
          rpId,
          userHandle,
          userVerification: needsUserVerification,
        });
        return { cipherId: createdCipher.id, userVerified };
      }
    } catch (error) {
      throw this.mapUserVerificationCancellation(error);
    } finally {
      // Make sure to clean up so the app is never stuck in modal mode
      await this.hideUi();
    }
  }

  /**
   * The logins this passkey could be added to: Login ciphers that match the
   * relying party — by URI or by an existing passkey's rpId — and that don't
   * already hold a passkey for this user handle. This is the single source of
   * truth for both the creation picker's list and the decision (in
   * {@link confirmNewCredential}) to skip that picker, so the two never
   * disagree. Computed once per ceremony and cached.
   */
  getMatchingLogins(): Promise<CipherView[]> {
    return (this.matchingLogins ??= this.computeMatchingLogins());
  }
  private matchingLogins?: Promise<CipherView[]>;

  private async computeMatchingLogins(): Promise<CipherView[]> {
    const rpId = this.windowObject.rpId;
    const userHandleBytes = this.windowObject.userHandle;
    if (!userHandleBytes) {
      return [];
    }
    const userHandle = Fido2Utils.arrayToString(new Uint8Array(userHandleBytes));

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    if (!activeUserId) {
      return [];
    }

    const equivalentDomains = await firstValueFrom(
      this.domainSettingsService.getUrlEquivalentDomains(rpId),
    );
    const ciphers = await this.cipherService.getAllDecrypted(activeUserId);

    return ciphers.filter(
      (cipher) =>
        cipher != null &&
        cipher.type === CipherType.Login &&
        (cipher.login?.matchesUri(rpId, equivalentDomains) ||
          cipher.login?.fido2Credentials?.some((cred) => cred.rpId === rpId)) &&
        Fido2Utils.cipherHasNoOtherPasskeys(cipher, userHandle) &&
        !cipher.deletedDate,
    );
  }

  /**
   * Returns the app to the state it was in before this ceremony showed any UI,
   * leaving a window the user already had open untouched when no UI was shown.
   *
   * `pickCredential` and `confirmNewCredential` wait for a result and call this
   * from their own `finally`. `informExcludedCredential` doesn't: it returns as
   * soon as the message is on screen, so the component showing that message
   * calls this when the user dismisses it. Safe to call more than once.
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

  private async showUi(
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

  /**
   * Can be called by the UI to create a new cipher with user input etc.
   * @param param0
   */
  async createCipher({ credentialName, userName, rpId }: NewCredentialParams): Promise<Cipher> {
    // Store the passkey on a new cipher to avoid replacing something important

    const cipher = new CipherView();
    cipher.name = credentialName;

    cipher.type = CipherType.Login;
    cipher.login = new LoginView();
    cipher.login.username = userName;
    cipher.login.uris = [new LoginUriView()];
    cipher.login.uris[0].uri = "https://" + rpId;
    cipher.card = new CardView();
    cipher.identity = new IdentityView();
    cipher.secureNote = new SecureNoteView();
    cipher.secureNote.type = SecureNoteType.Generic;
    cipher.reprompt = CipherRepromptType.None;

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    if (!activeUserId) {
      throw new Error("No active user ID found!");
    }

    try {
      const createdCipher = await this.cipherService.createWithServer(cipher, activeUserId);
      const encryptedCreatedCipher = await this.cipherService.encrypt(createdCipher, activeUserId);

      return encryptedCreatedCipher.cipher;
    } catch {
      throw new Error("Unable to create cipher");
    }
  }

  async updateCredential(cipher: CipherView): Promise<void> {
    this.logService.info("updateCredential");
    await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        map(async (a) => {
          if (a) {
            await this.cipherService.updateWithServer(cipher, a.id);
          }
        }),
      ),
    );
  }

  async informExcludedCredential(existingCipherIds: string[]): Promise<void> {
    this.logService.debug("informExcludedCredential", existingCipherIds);

    // make the cipherIds available to the UI.
    this.availableCipherIdsSubject.next(existingCipherIds);

    await this.showUi("/fido2-excluded", this.windowObject.windowXy, false);
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

  async informCredentialNotFound(): Promise<void> {
    this.logService.debug("informCredentialNotFound");
  }

  async close() {
    this.logService.debug("close");
  }

  /**
   * Verifies the user for the chosen cipher, choosing the strongest form of
   * verification already available before falling back to the OS prompt:
   *
   * 1. A master-password reprompt on the cipher is itself user verification, so
   *    satisfy the requirement with it rather than prompting the OS.
   * 2. Otherwise, unlocking the vault during this ceremony already verified the
   *    user.
   * 3. Otherwise verify through the OS when the relying party asked for it.
   *
   * The reprompt is checked before the vault-unlock shortcut because unlocking
   * may have used a method other than the master password (PIN, biometrics),
   * which does not satisfy a master-password reprompt.
   *
   * @throws {UserVerificationCanceled} if the user dismissed the prompt.
   */
  private async verifyUser(
    operation: Fido2UserVerificationOperation,
    username: string,
    needsUserVerification: boolean,
    cipher: CipherViewLike | undefined,
    { signal }: { signal: AbortSignal },
  ): Promise<boolean> {
    signal.throwIfAborted();

    const repromptType = cipher?.reprompt ?? CipherRepromptType.None;
    switch (repromptType) {
      case CipherRepromptType.None:
        break;
      case CipherRepromptType.Password:
        // TODO: Elide this prompt when the vault was unlocked with the master
        // password during this ceremony, since that already satisfies the reprompt.
        if (!(await this.passwordRepromptService.enabled())) {
          // An account with no master password can't be reprompted for one, so
          // the flag is inert — `PasswordRepromptService.showPasswordPrompt`
          // reports success without prompting for exactly this reason. Treat the
          // cipher as unprotected and verify by the usual means below, rather
          // than reporting a verification that never happened.
          break;
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
          "[DesktopFido2UserInterfaceSession]",
          `Refusing to use a cipher protected by unrecognized reprompt type ${repromptType}`,
        );
        throw new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.NotAllowed);
    }

    if (this.vaultUnlockedDuringCeremony) {
      this.logService.info(
        "[DesktopFido2UserInterfaceSession]",
        "Skipping user verification because the user unlocked their vault during this ceremony",
      );
      return true;
    }

    if (!needsUserVerification) {
      return false;
    }

    const modalMode = await firstValueFrom(this.desktopSettingsService.modalMode$);
    const isShowing = modalMode?.isModalModeActive ?? false;
    const windowHandle = isShowing
      ? this.windowObject.appWindowHandle
      : this.windowObject.clientWindowHandle;

    return await this.userVerificationService.verify(
      {
        operation,
        username,
        rpId: this.windowObject.rpId,
        requestContext: this.windowObject.requestContext,
        // Attach the prompt to whichever window the user is looking at.
        windowHandle,
      },
      { signal },
    );
  }

  /**
   * Translates a dismissed verification prompt into the error the authenticator
   * reports to the relying party, and passes anything else through untouched.
   */
  private mapUserVerificationCancellation(error: unknown): unknown {
    if (!(error instanceof UserVerificationCanceled)) {
      return error;
    }

    this.logService.info(
      "[DesktopFido2UserInterfaceSession]",
      "User cancelled during user verification. Aborting the request.",
    );
    return new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.NotAllowed);
  }
}

function fido2UserNameFromCipher(cipherView: CipherViewLike): string {
  const login = CipherViewLikeUtils.getLogin(cipherView);
  const username =
    (login?.fido2Credentials ?? []).at(0)?.userName ?? login?.username ?? cipherView.name;
  return username;
}
