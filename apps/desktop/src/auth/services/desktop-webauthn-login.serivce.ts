import { LoginStrategyServiceAbstraction, WebAuthnLoginCredentials } from "@bitwarden/auth/common";
import { WebAuthnLoginApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-api.service.abstraction";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { WebAuthnLoginCredentialAssertionOptionsView } from "@bitwarden/common/auth/models/view/webauthn-login/webauthn-login-credential-assertion-options.view";
import { WebAuthnLoginCredentialAssertionView } from "@bitwarden/common/auth/models/view/webauthn-login/webauthn-login-credential-assertion.view";
import { WebAuthnLoginAssertionResponseRequest } from "@bitwarden/common/auth/services/webauthn-login/request/webauthn-login-assertion-response.request";
import { WebAuthnLoginService } from "@bitwarden/common/auth/services/webauthn-login/webauthn-login.service";
import { PrfKey } from "@bitwarden/common/types/key";
import { LogService } from "@bitwarden/logging";

export class DesktopWebAuthnLoginService extends WebAuthnLoginService {
  constructor(
    webAuthnLoginApiService: WebAuthnLoginApiServiceAbstraction,
    loginStrategyService: LoginStrategyServiceAbstraction,
    webAuthnLoginPrfKeyService: WebAuthnLoginPrfKeyServiceAbstraction,
    window: Window,
    logService?: LogService,
  ) {
    super(
      webAuthnLoginApiService,
      loginStrategyService,
      webAuthnLoginPrfKeyService,
      window,
      logService,
    );
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
      const response = await ipc.auth.navigatorCredentialsGet(nativeOptions);
      this.logService.info("navigator.credentials.get response received", response);
      // if (!(response instanceof PublicKeyCredential)) {
      //   return undefined;
      // }
      // TODO: Remove `any` when typescript typings add support for PRF
      const prfResult = (response as any).prf as Uint8Array | undefined;
      let symmetricPrfKey: PrfKey | undefined;
      if (prfResult != undefined) {
        // Ensure we pass a plain ArrayBuffer (not a SharedArrayBuffer) by copying the bytes.
        symmetricPrfKey = await this.webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf(
          prfResult.slice().buffer,
        );
      }

      const deviceResponse = new WebAuthnLoginAssertionResponseRequest(
        response as any as PublicKeyCredential,
      );

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
