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
import { NativeAutofillUserVerificationCommand } from "../../platform/main/autofill/user-verification.command";
import { Utils } from "@bitwarden/common/platform/misc/utils";

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
    transactionContext?: ArrayBuffer,
  ): Promise<DesktopFido2UserInterfaceSession> {
    this.logService.debug("newSession", fallbackSupported, abortController, nativeWindowObject, transactionContext);
    const session = new DesktopFido2UserInterfaceSession(
      this.authService,
      this.cipherService,
      this.accountService,
      this.logService,
      this.router,
      this.desktopSettingsService,
      nativeWindowObject,
      transactionContext,
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
    private transactionContext: ArrayBuffer,
  ) {}

  private confirmCredentialSubject = new Subject<boolean>();

  private updatedCipher: CipherView;

  private rpId = new BehaviorSubject<string>(null);
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
      if (assumeUserPresence && cipherIds.length === 1 && !masterPasswordRepromptRequired && !userVerification) {
        this.logService.debug(
          "shortcut - Assuming user presence and returning cipherId",
          cipherIds[0],
        );
        return { cipherId: cipherIds[0], userVerified: userVerification };
      }

      this.logService.debug("Could not shortcut, showing UI");

      // TODO: We need to pass context from the original request whether this
      // should be a silent request or not. Then, we can fail here if it's
      // supposed to be silent.

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
    userHandle,
    userVerification,
    rpId,
  }: NewCredentialParams): Promise<{ cipherId: string; userVerified: boolean }> {
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

    const encCipher = await this.cipherService.encrypt(cipher, activeUserId);

    try {
      const createdCipher = await this.cipherService.createWithServer(encCipher);

      return createdCipher;
    } catch {
      throw new Error("Unable to create cipher");
    }
  }

  /** Called by the UI to prompt the user for verification. May be fulfilled by the OS. */
  async promptForUserVerification(cipher: CipherView): Promise<boolean> {
    this.logService.info("DesktopFido2UserInterfaceSession] Prompting for user verification")
    let cred = cipher.login.fido2Credentials[0];
    const username = cred.userName ?? cred.userDisplayName
    let windowHandle = await ipc.platform.getNativeWindowHandle();

    const uvResult = await ipc.autofill.runCommand<NativeAutofillUserVerificationCommand>({
      namespace: "autofill",
      command: "user-verification",
      params: {
        windowHandle: Utils.fromBufferToB64(windowHandle),
        transactionContext: Utils.fromBufferToB64(this.transactionContext),
        username,
        displayHint: `Logging in as ${cipher.name}`,
      },
    });
    if (uvResult.type === "error") {
      this.logService.error("Error getting user verification", uvResult.error)
      return false
    }
    return uvResult.type === "success";
  }

  async updateCredential(cipher: CipherView): Promise<void> {
    this.logService.info("updateCredential");
    await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        map(async (a) => {
          if (a) {
            const encCipher = await this.cipherService.encrypt(cipher, a.id);
            await this.cipherService.updateWithServer(encCipher);
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
      try {
        status2 = await lastValueFrom(
          this.authService.activeAccountStatus$.pipe(
            filter((s) => s === AuthenticationStatus.Unlocked),
            take(1),
            timeout(1000 * 60 * 5), // 5 minutes
          ),
        );
      } catch (error) {
        this.logService.warning("Error while waiting for vault to unlock", error);
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
}
