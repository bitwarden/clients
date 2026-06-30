// eslint-disable-next-line no-restricted-imports -- This is an Angular service
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { LoginSuccessHandlerService } from "@bitwarden/auth/common";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { WebAuthnLoginCredentialAssertionView } from "@bitwarden/common/auth/models/view/webauthn-login/webauthn-login-credential-assertion.view";
import { WebAuthnLoginAssertionResponseRequest } from "@bitwarden/common/auth/services/webauthn-login/request/webauthn-login-assertion-response.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { PasskeyRelayService, PasskeyLoginRelayResult } from "./passkey-relay.service";

/** Outcome of completing a passkey login via the relay result popout. */
export type PasskeyLoginOutcome =
  | { success: true; userId: UserId }
  | { success: false; errorMessage: string };

/**
 * Completes a passkey login that was relayed from the web-vault connector page.
 */
@Injectable({
  providedIn: "root",
})
export class LoginWithPasskeyResultService {
  private readonly passkeyRelayService = inject(PasskeyRelayService);
  private readonly webAuthnLoginService = inject(WebAuthnLoginServiceAbstraction);
  private readonly webAuthnLoginPrfKeyService = inject(WebAuthnLoginPrfKeyServiceAbstraction);
  private readonly loginSuccessHandlerService = inject(LoginSuccessHandlerService);
  private readonly keyService = inject(KeyService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  /**
   * Consumes the relayed passkey result, derives the PRF key, submits the assertion
   * to the server, and runs post-login setup when vault decryption is available.
   */
  async completeLogin(): Promise<PasskeyLoginOutcome> {
    this.logService.info("[PasskeyLogin] Starting completeLogin");

    const relayResult = await this.passkeyRelayService.consumeResult();

    if (!relayResult) {
      this.logService.error("[PasskeyLogin] No relay result available");
      return { success: false, errorMessage: this.i18nService.t("passkeyLoginTimeout") };
    }

    if (relayResult.type !== "login") {
      this.logService.error("[PasskeyLogin] Unexpected result type:", relayResult.type);
      return { success: false, errorMessage: this.i18nService.t("passkeyLoginTimeout") };
    }

    return this.processLogin(relayResult);
  }

  private async processLogin(relayResult: PasskeyLoginRelayResult): Promise<PasskeyLoginOutcome> {
    const { token, assertionData, prfOutput } = relayResult;

    this.logService.info("[PasskeyLogin] Parsing assertion data");

    let parsedAssertion: Record<string, unknown>;
    try {
      parsedAssertion = JSON.parse(assertionData) as Record<string, unknown>;
    } catch {
      this.logService.error("[PasskeyLogin] Failed to parse assertionData");
      return {
        success: false,
        errorMessage: this.i18nService.t("invalidPasskeyPleaseTryAgain"),
      };
    }

    const deviceResponse = Object.assign(
      Object.create(WebAuthnLoginAssertionResponseRequest.prototype),
      parsedAssertion,
    ) as WebAuthnLoginAssertionResponseRequest;

    let prfKey = null;
    if (prfOutput) {
      this.logService.info("[PasskeyLogin] Deriving PRF key...");
      try {
        prfKey = await this.webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf(prfOutput);
      } finally {
        // Zero the raw PRF bytes immediately after use
        new Uint8Array(prfOutput).fill(0);
      }
      this.logService.info("[PasskeyLogin] PRF key derived successfully");
    } else {
      this.logService.info("[PasskeyLogin] No PRF output, continuing without vault decryption key");
    }

    const assertion = new WebAuthnLoginCredentialAssertionView(token, deviceResponse, prfKey);

    this.logService.info("[PasskeyLogin] Calling webAuthnLoginService.logIn...");
    const authResult = await this.webAuthnLoginService.logIn(assertion);
    this.logService.info("[PasskeyLogin] Login result:", {
      requiresTwoFactor: authResult.requiresTwoFactor,
      userId: authResult.userId,
    });

    if (authResult.requiresTwoFactor) {
      return {
        success: false,
        errorMessage: this.i18nService.t("twoFactorForPasskeysNotSupportedOnClientUpdateToLogIn"),
      };
    }

    if (!authResult.userId) {
      return {
        success: false,
        errorMessage: this.i18nService.t("invalidPasskeyPleaseTryAgain"),
      };
    }

    // Only run the login success handler if the user has a decrypted user key.
    this.logService.info("[PasskeyLogin] Checking user key...");
    const userKey = await firstValueFrom(this.keyService.userKey$(authResult.userId));
    this.logService.info("[PasskeyLogin] User key exists:", !!userKey);
    if (userKey) {
      this.logService.info("[PasskeyLogin] Running login success handler...");
      await this.loginSuccessHandlerService.run(authResult.userId, null);
    }

    return { success: true, userId: authResult.userId };
  }
}
