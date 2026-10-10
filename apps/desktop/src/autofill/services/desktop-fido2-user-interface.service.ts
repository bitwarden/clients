import { Router } from "@angular/router";
import { firstValueFrom, map, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
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
  AutofillWindowObject,
  DesktopAutofillUiService,
  DesktopAutofillUiSession,
  throwOnAbort,
} from "./desktop-autofill-ui.service";
import {
  DesktopFido2UserVerificationService,
  Fido2UserVerificationOperation,
  UserVerificationCanceled,
} from "./desktop-fido2-user-verification.service.abstraction";

/**
 * This type is used to pass the window position from the native UI, plus the
 * relying-party details that only a passkey ceremony has.
 */
export type NativeWindowObject = AutofillWindowObject & {
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
    private autofillUiService: DesktopAutofillUiService,
  ) {}

  /**
   * The session currently on screen, when it is a passkey ceremony. Password and
   * one-time-code fills share the same holder, so narrow before handing one to a
   * caller that expects FIDO2-only members.
   */
  getCurrentSession(): DesktopFido2UserInterfaceSession | undefined {
    const session = this.autofillUiService.getCurrentSession();
    return session instanceof DesktopFido2UserInterfaceSession ? session : undefined;
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

    this.autofillUiService.setCurrentSession(session);
    return session;
  }
}

export class DesktopFido2UserInterfaceSession
  extends DesktopAutofillUiSession<NativeWindowObject>
  implements Fido2UserInterfaceSession
{
  constructor(
    authService: AuthService,
    private cipherService: CipherService,
    accountService: AccountService,
    logService: LogService,
    router: Router,
    desktopSettingsService: DesktopSettingsService,
    abortController: AbortController,
    windowObject: NativeWindowObject,
    private userVerificationService: DesktopFido2UserVerificationService,
    passwordRepromptService: PasswordRepromptService,
    private domainSettingsService: DomainSettingsService,
  ) {
    super(
      authService,
      accountService,
      logService,
      router,
      desktopSettingsService,
      abortController,
      windowObject,
      passwordRepromptService,
    );
  }

  protected override readonly logPrefix = "[DesktopFido2UserInterfaceSession]";

  private confirmCredentialSubject = new Subject<boolean>();

  private updatedCipher: CipherView | undefined = undefined;

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

      // TODO: Extend the selection deadline to the one indicated by the timeout
      // on the WebAuthn request.
      const chosenCipher = await this.selectCipher(params.cipherIds, "/fido2-assertion");

      if (!chosenCipher) {
        return { cipherId: undefined, userVerified: false };
      }

      const username = fido2UserNameFromCipher(chosenCipher);
      const userVerified = await this.verifyFido2User(
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
        const userVerified = await this.verifyFido2User(
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

  /**
   * Also releases the passkey-creation waiter, so dismissing any of this
   * ceremony's screens ends it rather than leaving `confirmNewCredential`
   * blocked until its deadline.
   */
  override cancel(): void {
    this.notifyConfirmCreateCredential(false);
    super.cancel();
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
      const userVerified = await this.verifyFido2User(
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

    this.publishAvailableCipherIds(existingCipherIds);

    await this.showUi("/fido2-excluded", this.windowObject.windowXy, false);
  }

  async informCredentialNotFound(): Promise<void> {
    this.logService.debug("informCredentialNotFound");
  }

  /**
   * A relying party can't ask for a reprompt type this build doesn't recognize,
   * so refusing the cipher has to be reported as an authenticator failure.
   */
  protected override unrecognizedRepromptError(): unknown {
    return new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.NotAllowed);
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
  private async verifyFido2User(
    operation: Fido2UserVerificationOperation,
    username: string,
    needsUserVerification: boolean,
    cipher: CipherViewLike | undefined,
    { signal }: { signal: AbortSignal },
  ): Promise<boolean> {
    signal.throwIfAborted();

    if (await this.verifyReprompt(cipher)) {
      return true;
    }

    if (this.vaultUnlockedDuringCeremony) {
      this.logService.info(
        this.logPrefix,
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
