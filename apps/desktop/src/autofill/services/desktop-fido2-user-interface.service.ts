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

export class DesktopFido2UserInterfaceService
  implements Fido2UserInterfaceServiceAbstraction<NativeWindowObject>
{
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
    this.logService.warning("newSession", fallbackSupported, abortController, nativeWindowObject);
    const session = new DesktopFido2UserInterfaceSession(
      this.authService,
      this.cipherService,
      this.accountService,
      this.logService,
      this.router,
      this.desktopSettingsService,
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
    private windowObject: NativeWindowObject,
  ) {}

  private confirmCredentialSubject = new Subject<boolean>();
  private createdCipher: Cipher;

  private availableCipherIdsSubject = new BehaviorSubject<string[]>(null);
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
    this.logService.warning("pickCredential desktop function", {
      cipherIds,
      userVerification,
      assumeUserPresence,
      masterPasswordRepromptRequired,
    });

    try {
      // Check if we can return the credential without user interaction
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

      await this.showUi("/passkeys", this.windowObject.windowXy);

      const chosenCipherResponse = await this.waitForUiChosenCipher();

      this.logService.debug("Received chosen cipher", chosenCipherResponse);

      return {
        cipherId: chosenCipherResponse.cipherId,
        userVerified: chosenCipherResponse.userVerified,
      };
    } finally {
      // Make sure to clean up so the app is never stuck in modal mode?
      await this.desktopSettingsService.setModalMode(false);
    }
  }

  confirmChosenCipher(cipherId: string, userVerified: boolean = false): void {
    this.chosenCipherSubject.next({ cipherId, userVerified });
    this.chosenCipherSubject.complete();
  }

  private async waitForUiChosenCipher(
    timeoutMs: number = 60000,
  ): Promise<{ cipherId: string; userVerified: boolean } | undefined> {
    try {
      return await lastValueFrom(this.chosenCipherSubject.pipe(timeout(timeoutMs)));
    } catch {
      // If we hit a timeout, return undefined instead of throwing
      this.logService.warning("Timeout: User did not select a cipher within the allowed time", {
        timeoutMs,
      });
      return { cipherId: undefined, userVerified: false };
    }
  }

  /**
   * Notifies the Fido2UserInterfaceSession that the UI operations has completed and it can return to the OS.
   */
  notifyConfirmNewCredential(confirmed: boolean): void {
    this.confirmCredentialSubject.next(confirmed);
    this.confirmCredentialSubject.complete();
  }

  /**
   * Returns once the UI has confirmed and completed the operation
   * @returns
   */
  private async waitForUiNewCredentialConfirmation(): Promise<boolean> {
    return lastValueFrom(this.confirmCredentialSubject);
  }

  /**
   * This is called by the OS. It loads the UI and waits for the user to confirm the new credential. Once the UI has confirmed, it returns to the the OS.
   * @param param0
   * @returns
   */
  async confirmNewCredential({
    credentialName,
    userName,
    userVerification,
    rpId,
  }: NewCredentialParams): Promise<{ cipherId: string; userVerified: boolean }> {
    this.logService.warning(
      "confirmNewCredential",
      credentialName,
      userName,
      userVerification,
      rpId,
    );

    try {
      await this.showUi("/passkeys", this.windowObject.windowXy);

      // Wait for the UI to wrap up
      const confirmation = await this.waitForUiNewCredentialConfirmation();
      if (!confirmation) {
        return { cipherId: undefined, userVerified: false };
      }
      // Create the credential
      await this.createCredential({
        credentialName,
        userName,
        rpId,
        userHandle: "",
        userVerification,
      });

      // wait for 10ms to help RXJS catch up(?)
      // We sometimes get a race condition from this.createCredential not updating cipherService in time
      //console.log("waiting 10ms..");
      //await new Promise((resolve) => setTimeout(resolve, 10));
      //console.log("Just waited 10ms");

      // Return the new cipher (this.createdCipher)
      return { cipherId: this.createdCipher.id, userVerified: userVerification };
    } finally {
      // Make sure to clean up so the app is never stuck in modal mode?
      await this.desktopSettingsService.setModalMode(false);
    }
  }

  private async showUi(route: string, position?: { x: number; y: number }): Promise<void> {
    // Load the UI:
    await this.desktopSettingsService.setModalMode(true, position);
    await this.router.navigate(["/passkeys"]);
  }

  /**
   * Can be called by the UI to create a new credential with user input etc.
   * @param param0
   */
  async createCredential({ credentialName, userName, rpId }: NewCredentialParams): Promise<Cipher> {
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

    const encCipher = await this.cipherService.encrypt(cipher, activeUserId);
    const createdCipher = await this.cipherService.createWithServer(encCipher);

    this.createdCipher = createdCipher;

    return createdCipher;
  }

  async informExcludedCredential(existingCipherIds: string[]): Promise<void> {
    this.logService.warning("informExcludedCredential", existingCipherIds);
  }

  async ensureUnlockedVault(): Promise<void> {
    this.logService.warning("ensureUnlockedVault");

    const status = await firstValueFrom(this.authService.activeAccountStatus$);
    if (status !== AuthenticationStatus.Unlocked) {
      throw new Error("Vault is not unlocked");
    }
  }

  async informCredentialNotFound(): Promise<void> {
    this.logService.warning("informCredentialNotFound");
  }

  async close() {
    this.logService.warning("close");
  }
}
