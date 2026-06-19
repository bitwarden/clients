import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DeleteTwoFactorAuthenticatorRequest } from "@bitwarden/common/auth/models/request/delete-two-factor-authenticator.request";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { TwoFactorDuoDeleteRequest } from "@bitwarden/common/auth/models/request/two-factor-duo-delete.request";
import { TwoFactorEmailDeleteRequest } from "@bitwarden/common/auth/models/request/two-factor-email-delete.request";
import { TwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/two-factor-email.request";
import { TwoFactorOrganizationDuoDeleteRequest } from "@bitwarden/common/auth/models/request/two-factor-organization-duo-delete.request";
import { TwoFactorWebAuthnDeleteAllRequest } from "@bitwarden/common/auth/models/request/two-factor-web-authn-delete-all.request";
import { TwoFactorYubiKeyDeleteRequest } from "@bitwarden/common/auth/models/request/two-factor-yubikey-delete.request";
import { UpdateTwoFactorAuthenticatorRequest } from "@bitwarden/common/auth/models/request/update-two-factor-authenticator.request";
import { UpdateTwoFactorDuoRequest } from "@bitwarden/common/auth/models/request/update-two-factor-duo.request";
import { UpdateTwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/update-two-factor-email.request";
import { UpdateTwoFactorWebAuthnDeleteRequest } from "@bitwarden/common/auth/models/request/update-two-factor-web-authn-delete.request";
import { UpdateTwoFactorWebAuthnRequest } from "@bitwarden/common/auth/models/request/update-two-factor-web-authn.request";
import { UpdateTwoFactorYubikeyOtpRequest } from "@bitwarden/common/auth/models/request/update-two-factor-yubikey-otp.request";
import { TwoFactorAuthenticatorResponse } from "@bitwarden/common/auth/models/response/two-factor-authenticator.response";
import { TwoFactorDuoResponse } from "@bitwarden/common/auth/models/response/two-factor-duo.response";
import { TwoFactorEmailResponse } from "@bitwarden/common/auth/models/response/two-factor-email.response";
import { TwoFactorProviderResponse } from "@bitwarden/common/auth/models/response/two-factor-provider.response";
import { TwoFactorRecoverResponse } from "@bitwarden/common/auth/models/response/two-factor-recover.response";
import { TwoFactorWebAuthnChallengeResponse } from "@bitwarden/common/auth/models/response/two-factor-web-authn-challenge.response";
import { TwoFactorWebAuthnResponse } from "@bitwarden/common/auth/models/response/two-factor-web-authn.response";
import { TwoFactorYubiKeyResponse } from "@bitwarden/common/auth/models/response/two-factor-yubi-key.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { TwoFactorApiService } from "../abstractions/two-factor-api.service";

export class DefaultTwoFactorApiService implements TwoFactorApiService {
  constructor(private apiService: ApiService) {}

  // Providers

  async getTwoFactorProviders(): Promise<ListResponse<TwoFactorProviderResponse>> {
    const response = await this.apiService.send("GET", "/two-factor", null, true, true);
    return new ListResponse(response, TwoFactorProviderResponse);
  }

  async getTwoFactorOrganizationProviders(
    organizationId: string,
  ): Promise<ListResponse<TwoFactorProviderResponse>> {
    const response = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/two-factor`,
      null,
      true,
      true,
    );
    return new ListResponse(response, TwoFactorProviderResponse);
  }

  // Authenticator (TOTP)

  async getTwoFactorAuthenticator(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorAuthenticatorResponse> {
    const response = await this.apiService.send(
      "POST",
      "/two-factor/get-authenticator",
      request,
      true,
      true,
    );
    return new TwoFactorAuthenticatorResponse(response);
  }

  async putTwoFactorAuthenticator(
    request: UpdateTwoFactorAuthenticatorRequest,
  ): Promise<TwoFactorAuthenticatorResponse> {
    const response = await this.apiService.send(
      "PUT",
      "/two-factor/authenticator",
      request,
      true,
      true,
    );
    return new TwoFactorAuthenticatorResponse(response);
  }

  async deleteTwoFactorAuthenticator(
    request: DeleteTwoFactorAuthenticatorRequest,
  ): Promise<TwoFactorProviderResponse> {
    const response = await this.apiService.send(
      "DELETE",
      "/two-factor/authenticator",
      request,
      true,
      true,
    );
    return new TwoFactorProviderResponse(response);
  }

  // Email

  async getTwoFactorEmail(request: SecretVerificationRequest): Promise<TwoFactorEmailResponse> {
    const response = await this.apiService.send(
      "POST",
      "/two-factor/get-email",
      request,
      true,
      true,
    );
    return new TwoFactorEmailResponse(response);
  }

  async postTwoFactorEmailSetup(request: TwoFactorEmailRequest): Promise<any> {
    return this.apiService.send("POST", "/two-factor/send-email", request, true, false);
  }

  async postTwoFactorEmail(request: TwoFactorEmailRequest): Promise<any> {
    return this.apiService.send("POST", "/two-factor/send-email-login", request, false, false);
  }

  async putTwoFactorEmail(request: UpdateTwoFactorEmailRequest): Promise<TwoFactorEmailResponse> {
    const response = await this.apiService.send("PUT", "/two-factor/email", request, true, true);
    return new TwoFactorEmailResponse(response);
  }

  async deleteTwoFactorEmail(
    request: TwoFactorEmailDeleteRequest,
  ): Promise<TwoFactorProviderResponse> {
    const response = await this.apiService.send("DELETE", "/two-factor/email", request, true, true);
    return new TwoFactorProviderResponse(response);
  }

  // Duo

  async getTwoFactorDuo(request: SecretVerificationRequest): Promise<TwoFactorDuoResponse> {
    const response = await this.apiService.send("POST", "/two-factor/get-duo", request, true, true);
    return new TwoFactorDuoResponse(response);
  }

  async getTwoFactorOrganizationDuo(
    organizationId: string,
    request: SecretVerificationRequest,
  ): Promise<TwoFactorDuoResponse> {
    const response = await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/two-factor/get-duo`,
      request,
      true,
      true,
    );
    return new TwoFactorDuoResponse(response);
  }

  async putTwoFactorDuo(request: UpdateTwoFactorDuoRequest): Promise<TwoFactorDuoResponse> {
    const response = await this.apiService.send("PUT", "/two-factor/duo", request, true, true);
    return new TwoFactorDuoResponse(response);
  }

  async deleteTwoFactorDuo(request: TwoFactorDuoDeleteRequest): Promise<TwoFactorProviderResponse> {
    const response = await this.apiService.send("DELETE", "/two-factor/duo", request, true, true);
    return new TwoFactorProviderResponse(response);
  }

  async putTwoFactorOrganizationDuo(
    organizationId: string,
    request: UpdateTwoFactorDuoRequest,
  ): Promise<TwoFactorDuoResponse> {
    const response = await this.apiService.send(
      "PUT",
      `/organizations/${organizationId}/two-factor/duo`,
      request,
      true,
      true,
    );
    return new TwoFactorDuoResponse(response);
  }

  async deleteTwoFactorOrganizationDuo(
    organizationId: string,
    request: TwoFactorOrganizationDuoDeleteRequest,
  ): Promise<TwoFactorProviderResponse> {
    const response = await this.apiService.send(
      "DELETE",
      `/organizations/${organizationId}/two-factor/duo`,
      request,
      true,
      true,
    );
    return new TwoFactorProviderResponse(response);
  }

  // YubiKey

  async getTwoFactorYubiKey(request: SecretVerificationRequest): Promise<TwoFactorYubiKeyResponse> {
    const response = await this.apiService.send(
      "POST",
      "/two-factor/get-yubikey",
      request,
      true,
      true,
    );
    return new TwoFactorYubiKeyResponse(response);
  }

  async putTwoFactorYubiKey(
    request: UpdateTwoFactorYubikeyOtpRequest,
  ): Promise<TwoFactorYubiKeyResponse> {
    const response = await this.apiService.send("PUT", "/two-factor/yubikey", request, true, true);
    return new TwoFactorYubiKeyResponse(response);
  }

  async deleteTwoFactorYubiKey(
    request: TwoFactorYubiKeyDeleteRequest,
  ): Promise<TwoFactorProviderResponse> {
    const response = await this.apiService.send(
      "DELETE",
      "/two-factor/yubikey",
      request,
      true,
      true,
    );
    return new TwoFactorProviderResponse(response);
  }

  // WebAuthn

  async getTwoFactorWebAuthn(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorWebAuthnResponse> {
    const response = await this.apiService.send(
      "POST",
      "/two-factor/get-webauthn",
      request,
      true,
      true,
    );
    return new TwoFactorWebAuthnResponse(response);
  }

  async getTwoFactorWebAuthnChallenge(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorWebAuthnChallengeResponse> {
    const response = await this.apiService.send(
      "POST",
      "/two-factor/get-webauthn-challenge",
      request,
      true,
      true,
    );
    return new TwoFactorWebAuthnChallengeResponse(response);
  }

  async putTwoFactorWebAuthn(
    request: UpdateTwoFactorWebAuthnRequest,
  ): Promise<TwoFactorWebAuthnResponse> {
    const deviceResponse = request.deviceResponse.response as AuthenticatorAttestationResponse;
    const body: any = Object.assign({}, request);

    body.deviceResponse = {
      id: request.deviceResponse.id,
      rawId: btoa(request.deviceResponse.id),
      type: request.deviceResponse.type,
      extensions: request.deviceResponse.getClientExtensionResults(),
      response: {
        AttestationObject: Utils.fromBufferToB64(deviceResponse.attestationObject),
        clientDataJson: Utils.fromBufferToB64(deviceResponse.clientDataJSON),
      },
    };

    const response = await this.apiService.send("PUT", "/two-factor/webauthn", body, true, true);
    return new TwoFactorWebAuthnResponse(response);
  }

  async deleteTwoFactorWebAuthn(
    request: UpdateTwoFactorWebAuthnDeleteRequest,
  ): Promise<TwoFactorWebAuthnResponse> {
    const response = await this.apiService.send(
      "DELETE",
      "/two-factor/webauthn",
      request,
      true,
      true,
    );
    return new TwoFactorWebAuthnResponse(response);
  }

  async deleteTwoFactorWebAuthnAll(
    request: TwoFactorWebAuthnDeleteAllRequest,
  ): Promise<TwoFactorProviderResponse> {
    const response = await this.apiService.send(
      "DELETE",
      "/two-factor/webauthn/all",
      request,
      true,
      true,
    );
    return new TwoFactorProviderResponse(response);
  }

  // Recovery Code

  async getTwoFactorRecover(request: SecretVerificationRequest): Promise<TwoFactorRecoverResponse> {
    const response = await this.apiService.send(
      "POST",
      "/two-factor/get-recover",
      request,
      true,
      true,
    );
    return new TwoFactorRecoverResponse(response);
  }
}
