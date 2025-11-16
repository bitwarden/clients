// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LoginStrategyServiceAbstraction, WebAuthnLoginCredentials } from "@bitwarden/auth/common";

import { LogService } from "../../../platform/abstractions/log.service";
import { PrfKey } from "../../../types/key";
import { WebAuthnLoginApiServiceAbstraction } from "../../abstractions/webauthn/webauthn-login-api.service.abstraction";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "../../abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { WebAuthnLoginServiceAbstraction } from "../../abstractions/webauthn/webauthn-login.service.abstraction";
import { AuthResult } from "../../models/domain/auth-result";
import { WebAuthnLoginCredentialAssertionOptionsView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion-options.view";
import { WebAuthnLoginCredentialAssertionView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion.view";

import { WebAuthnLoginAssertionResponseRequest } from "./request/webauthn-login-assertion-response.request";

export class WebAuthnLoginService implements WebAuthnLoginServiceAbstraction {
  private navigatorCredentials: CredentialsContainer;

  constructor(
    private webAuthnLoginApiService: WebAuthnLoginApiServiceAbstraction,
    protected loginStrategyService: LoginStrategyServiceAbstraction,
    protected webAuthnLoginPrfKeyService: WebAuthnLoginPrfKeyServiceAbstraction,
    private window: Window,
    protected logService?: LogService,
  ) {
    this.navigatorCredentials = this.window.navigator.credentials;
  }

  async getCredentialAssertionOptions(): Promise<WebAuthnLoginCredentialAssertionOptionsView> {
    const response = await this.webAuthnLoginApiService.getCredentialAssertionOptions();
    return new WebAuthnLoginCredentialAssertionOptionsView(response.options, response.token);
  }

  async assertCredential(
    credentialAssertionOptions: WebAuthnLoginCredentialAssertionOptionsView,
  ): Promise<WebAuthnLoginCredentialAssertionView> {
    const nativeOptions: CredentialRequestOptions = {
      publicKey: credentialAssertionOptions.options,
    };
    // TODO: Remove `any` when typescript typings add support for PRF
    nativeOptions.publicKey.extensions = {
      prf: { eval: { first: await this.webAuthnLoginPrfKeyService.getLoginWithPrfSalt() } },
    } as any;

    try {
      const response = await this.navigatorCredentials.get(nativeOptions);
      if (!(response instanceof PublicKeyCredential)) {
        return undefined;
      }
      // TODO: Remove `any` when typescript typings add support for PRF
      const prfResult = (response.getClientExtensionResults() as any).prf?.results?.first;
      let symmetricPrfKey: PrfKey | undefined;
      if (prfResult != undefined) {
        symmetricPrfKey =
          await this.webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf(prfResult);
      }

      const deviceResponse = new WebAuthnLoginAssertionResponseRequest(response);

      // Verify that we aren't going to send PRF information to the server in any case.
      // Note: this will only happen if a dev has done something wrong.
      if ("prf" in deviceResponse.extensions) {
        throw new Error("PRF information is not allowed to be sent to the server.");
      }

      return new WebAuthnLoginCredentialAssertionView(
        credentialAssertionOptions.token,
        deviceResponse,
        symmetricPrfKey,
      );
    } catch (error) {
      this.logService?.error(error);
      return undefined;
    }
  }

  async logIn(assertion: WebAuthnLoginCredentialAssertionView): Promise<AuthResult> {
    const credential = new WebAuthnLoginCredentials(
      assertion.token,
      assertion.deviceResponse,
      assertion.prfKey,
    );
    const result = await this.loginStrategyService.logIn(credential);
    return result;
  }
}
