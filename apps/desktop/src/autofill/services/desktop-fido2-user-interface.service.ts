// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
import {
  Fido2UserInterfaceService as Fido2UserInterfaceServiceAbstraction,
  Fido2UserInterfaceSession,
  NewCredentialParams,
  PickCredentialParams,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-user-interface.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType, SecureNoteType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

/**
 * This type is used to pass the window position from the native UI
 */
export type NativeWindowObject = {
  /**
   * The position of the window, first entry is the x position, second is the y position
   */
  windowXy?: { x: number; y: number };
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
  ) {}

  private confirmCredentialSubject = new Subject<boolean>();

  private updatedCipher: CipherView | undefined = undefined;

  private rpId = new BehaviorSubject<string | null>(null);
  private availableCipherIdsSubject = new BehaviorSubject<string[]>([""]);
  /**
   * Observable that emits available cipher IDs once they're confirmed by the UI
   */
  availableCipherIds$ = this.availableCipherIdsSubject.pipe(
    filter((ids) => ids != null),
    take(1),
  );

  private chosenCipherSubject = new Subject<{ cipherId: string; userVerified: boolean }>();

  // Method implementation
  async pickCredential({
    cipherIds,
    userVerification,
    assumeUserPresence,
    masterPasswordRepromptRequired,
  }: PickCredentialParams): Promise<{ cipherId: string; userVerified: boolean }> {
    this.logService.debug("pickCredential desktop function", {
      cipherIds,
      userVerification,
      assumeUserPresence,
      masterPasswordRepromptRequired,
    });

    try {
      // Check if we can return the credential without user interaction
      await this.accountService.setShowHeader(false);
      if (assumeUserPresence && cipherIds.length === 1 && !masterPasswordRepromptRequired) {
        this.logService.debug(
          "shortcut - Assuming user presence and returning cipherId",
          cipherIds[0],
        );
        return { cipherId: cipherIds[0], userVerified: userVerification };
      }

      this.logService.debug("Could not shortcut, showing UI");

      // make the cipherIds available to the UI.
      this.availableCipherIdsSubject.next(cipherIds);

      await this.showUi("/fido2-assertion", this.windowObject.windowXy, false);

      // TODO: Extend this to the deadline indicated by the timeout on the WebAuthn request.
      const chosenCipherTimeout = AbortSignal.timeout(60 * 1000);
      const chosenCipherResponse = await this.waitForUiChosenCipher({
        signal: AbortSignal.any([this.abortController.signal, chosenCipherTimeout]),
      });

      this.logService.debug("Received chosen cipher", chosenCipherResponse);

      return {
        cipherId: chosenCipherResponse?.cipherId,
        userVerified: chosenCipherResponse?.userVerified,
      };
    } finally {
      // Make sure to clean up so the app is never stuck in modal mode?
      await this.desktopSettingsService.setModalMode(false);
      await this.accountService.setShowHeader(true);
    }
  }

  async getRpId(): Promise<string> {
    return firstValueFrom(this.rpId.pipe(filter((id) => id != null)));
  }

  confirmChosenCipher(cipherId: string, userVerified: boolean = false): void {
    this.chosenCipherSubject.next({ cipherId, userVerified });
    this.chosenCipherSubject.complete();
  }

  private async waitForUiChosenCipher({
    signal,
  }: {
    signal: AbortSignal;
  }): Promise<{ cipherId?: string; userVerified: boolean }> {
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
      return { cipherId: undefined, userVerified: false };
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
    userVerification,
    rpId,
  }: NewCredentialParams): Promise<{ cipherId: string | undefined; userVerified: boolean }> {
    this.logService.debug(
      "confirmNewCredential",
      credentialName,
      userName,
      userHandle,
      userVerification,
      rpId,
    );
    this.rpId.next(rpId);

    try {
      await this.showUi("/fido2-creation", this.windowObject.windowXy, false);

      // Wait for the UI to wrap up
      const confirmation = await this.waitForUiNewCredentialConfirmation({
        signal: this.abortController.signal,
      });
      if (!confirmation) {
        return { cipherId: undefined, userVerified: false };
      }

      if (this.updatedCipher) {
        await this.updateCredential(this.updatedCipher);
        return { cipherId: this.updatedCipher.id, userVerified: userVerification };
      } else {
        // Create the cipher
        const createdCipher = await this.createCipher({
          credentialName,
          userName,
          rpId,
          userHandle,
          userVerification,
        });
        return { cipherId: createdCipher.id, userVerified: userVerification };
      }
    } finally {
      // Make sure to clean up so the app is never stuck in modal mode?
      await this.desktopSettingsService.setModalMode(false);
      await this.accountService.setShowHeader(true);
    }
  }

  private async hideUi(): Promise<void> {
    await this.desktopSettingsService.setModalMode(false);
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

    await this.accountService.setShowHeader(false);
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

      if (status2 === AuthenticationStatus.Unlocked) {
        await this.router.navigate(["/"]);
      }

      if (status2 !== AuthenticationStatus.Unlocked) {
        await this.hideUi();
        throw new Error("Vault is not unlocked");
      }
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
}
