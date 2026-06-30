// eslint-disable-next-line no-restricted-imports -- This is an Angular service
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { PasskeyRelayService, PasskeyUnlockRelayResult } from "./passkey-relay.service";

/** Outcome of completing a passkey unlock via the relay result popout. */
export type PasskeyUnlockOutcome =
  | { success: true }
  | { success: false; errorMessage: string; canceled: boolean };

/**
 * Completes a passkey vault unlock that was relayed from the web-vault connector page.
 */
@Injectable({
  providedIn: "root",
})
export class UnlockWithPasskeyResultService {
  private readonly passkeyRelayService = inject(PasskeyRelayService);
  private readonly webAuthnLoginPrfKeyService = inject(WebAuthnLoginPrfKeyServiceAbstraction);
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);
  private readonly accountService = inject(AccountService);
  private readonly encryptService = inject(EncryptService);
  private readonly keyService = inject(KeyService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  /**
   * Consumes the relayed unlock result, derives the PRF key, decrypts the user's
   * private key and user key, and stores the user key.
   */
  async completeUnlock(): Promise<PasskeyUnlockOutcome> {
    this.logService.info("[PasskeyUnlock] Starting completeUnlock");

    const relayResult = await this.passkeyRelayService.consumeResult();

    if (!relayResult) {
      this.logService.error("[PasskeyUnlock] No relay result available");
      return {
        success: false,
        errorMessage: this.i18nService.t("passkeyUnlockTimeout"),
        canceled: false,
      };
    }

    if (relayResult.type !== "unlock") {
      this.logService.error("[PasskeyUnlock] Unexpected result type:", relayResult.type);
      return {
        success: false,
        errorMessage: this.i18nService.t("passkeyUnlockTimeout"),
        canceled: false,
      };
    }

    try {
      await this.processUnlock(relayResult);
      this.logService.info("[PasskeyUnlock] Unlock complete");
      return { success: true };
    } catch (error) {
      this.logService.error("[PasskeyUnlock] Error in completeUnlock:", error);

      if (error instanceof Error && error.message.includes("canceled")) {
        return { success: false, errorMessage: "", canceled: true };
      }

      return {
        success: false,
        errorMessage:
          error instanceof Error ? error.message : this.i18nService.t("unexpectedError"),
        canceled: false,
      };
    }
  }

  private async processUnlock(relayResult: PasskeyUnlockRelayResult): Promise<void> {
    const { credentialId, prfOutput } = relayResult;

    this.logService.info("[PasskeyUnlock] Deriving PRF key...");
    const prfKey = await this.webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf(prfOutput);
    // Zero the raw PRF bytes immediately after use
    new Uint8Array(prfOutput).fill(0);
    this.logService.info("[PasskeyUnlock] PRF key derived successfully");

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (!activeAccount?.id) {
      throw new Error("No active account found");
    }
    const userId = activeAccount.id as UserId;

    this.logService.info("[PasskeyUnlock] Getting user decryption options...");
    const userDecryptionOptions = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
    );

    if (!userDecryptionOptions?.webAuthnPrfOptions) {
      throw new Error("No WebAuthn PRF options available for user");
    }

    const prfOption = userDecryptionOptions.webAuthnPrfOptions.find(
      (option: { credentialId: string }) => option.credentialId === credentialId,
    );

    if (!prfOption) {
      throw new Error("No matching WebAuthn PRF option found for this credential");
    }

    const privateKey = await this.encryptService.unwrapDecapsulationKey(
      new EncString(prfOption.encryptedPrivateKey),
      prfKey,
    );

    const userKey = await this.encryptService.decapsulateKeyUnsigned(
      new EncString(prfOption.encryptedUserKey),
      privateKey,
    );

    if (!userKey) {
      throw new Error("Failed to decrypt user key from private key");
    }

    await this.keyService.setUserKey(userKey as UserKey, userId);
  }
}
