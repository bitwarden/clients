// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Router } from "@angular/router";
import {
  lastValueFrom,
  firstValueFrom,
  map,
  Subject,
  filter,
  take,
  BehaviorSubject,
  timeout,
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
    // The interface marks this as optional, but in the Desktop implementation, we always pass an AbortController.
    // We should see if we can change the interface type to require this object.
    abortController: AbortController,
  ): Promise<DesktopFido2UserInterfaceSession> {
    this.logService.debug("newSession", fallbackSupported, abortController, nativeWindowObject);
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

      const chosenCipherResponse = await this.waitForUiChosenCipher();

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

  private async waitForUiChosenCipher(
    timeoutMs: number = 60000,
  ): Promise<{ cipherId?: string; userVerified: boolean } | undefined> {
    const { promise: cancelPromise, listener: abortFn } = this.subscribeToCancellation();
    try {
      this.abortController.signal.throwIfAborted();
      const confirmPromise = lastValueFrom(this.chosenCipherSubject.pipe(timeout(timeoutMs)));
      return await Promise.race([confirmPromise, cancelPromise]);
    } catch {
      // If we hit a timeout or if the request is cancelled, return undefined instead of throwing
      if (this.abortController.signal.aborted) {
        this.logService.warning("Request was cancelled before the user selected a cipher");
      } else {
        this.logService.warning("Timeout: User did not select a cipher within the allowed time", {
          timeoutMs,
        });
      }
      return { cipherId: undefined, userVerified: false };
    } finally {
      this.unsubscribeCancellation(abortFn);
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
  private async waitForUiNewCredentialConfirmation(): Promise<boolean> {
    const { promise: cancelPromise, listener: abortFn } = this.subscribeToCancellation();
    try {
      this.abortController.signal.throwIfAborted();
      const confirmPromise = lastValueFrom(this.confirmCredentialSubject);
      return await Promise.race([confirmPromise, cancelPromise]);
    } catch (error) {
      if (this.abortController.signal.aborted) {
        this.logService.warning("Request was cancelled before the user confirmed a cipher");
      } else {
        this.logService.error("Error occurred while waiting for user confirmation", error);
      }

      // On cancellation or error, return false instead of throwing
      return false;
    } finally {
      this.unsubscribeCancellation(abortFn);
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
      const confirmation = await this.waitForUiNewCredentialConfirmation();
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
      await this.showUi("/lock", this.windowObject.windowXy, true, true);

      let status2: AuthenticationStatus;
      const { promise: cancelPromise, listener: abortFn } = this.subscribeToCancellation();
      try {
        const lockStatusPromise = lastValueFrom(
          this.authService.activeAccountStatus$.pipe(
            filter((s) => s === AuthenticationStatus.Unlocked),
            take(1),
            timeout(1000 * 60 * 5), // 5 minutes
          ),
        );
        status2 = await Promise.race([lockStatusPromise, cancelPromise]);
      } catch (error) {
        this.logService.warning("Error while waiting for vault to unlock", error);
        await this.hideUi();
        throw new Error("Could not retrieve vault unlock status");
      } finally {
        this.unsubscribeCancellation(abortFn);
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

  async informCredentialNotFound(): Promise<void> {
    this.logService.debug("informCredentialNotFound");
  }

  async close() {
    this.logService.debug("close");
  }

  /** Returns a promise that will be rejected if the session's abort signal is fired. */
  private subscribeToCancellation() {
    let cancelReject: (reason?: any) => void;
    const cancelPromise: Promise<never> = new Promise((_, reject) => {
      cancelReject = reject;
    });
    const abortFn = (ev: Event) => {
      if (ev.target instanceof AbortSignal) {
        cancelReject(ev.target.reason);
      }
    };
    this.abortController.signal.addEventListener("abort", abortFn, { once: true });

    // Guard against an unhandled rejection. If the signal aborts after the
    // consumer has already stopped racing this promise (e.g. the UI resolved
    // first, but the listener hasn't been removed yet), the rejection would
    // otherwise surface with no attached handler. Racing consumers attach their
    // own handler, so this no-op does not swallow the cancellation.
    cancelPromise.catch(() => {});

    return { promise: cancelPromise, listener: abortFn };
  }

  /** Cleans up event listeners for cancellation */
  private unsubscribeCancellation(listener: (ev: Event) => void): void {
    this.abortController.signal.removeEventListener("abort", listener);
  }
}
