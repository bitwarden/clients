import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { TwoFactorAuthenticatorDeleteRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-authenticator-delete.request";
import { TwoFactorAuthenticatorUpdateRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-authenticator-update.request";
import { TwoFactorDuoDeleteRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-duo-delete.request";
import { TwoFactorDuoUpdateRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-duo-update.request";
import { TwoFactorEmailDeleteRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-email-delete.request";
import { TwoFactorEmailLoginRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-email-login.request";
import { TwoFactorEmailSetupRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-email-setup.request";
import { TwoFactorEmailUpdateRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-email-update.request";
import { TwoFactorOrganizationDuoDeleteRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-organization-duo-delete.request";
import { TwoFactorWebAuthnDeleteAllRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-web-authn-delete-all.request";
import { TwoFactorWebAuthnDeleteRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-web-authn-delete.request";
import { TwoFactorWebAuthnUpdateRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-web-authn-update.request";
import { TwoFactorYubiKeyDeleteRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-yubikey-delete.request";
import { TwoFactorYubiKeyUpdateRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-yubikey-update.request";
import { TwoFactorAuthenticatorUpdateResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-authenticator-update.response";
import { TwoFactorAuthenticatorResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-authenticator.response";
import { TwoFactorDuoUpdateResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-duo-update.response";
import { TwoFactorDuoResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-duo.response";
import { TwoFactorEmailUpdateResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-email-update.response";
import { TwoFactorEmailResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-email.response";
import { TwoFactorOrganizationDuoUpdateResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-organization-duo-update.response";
import { TwoFactorOrganizationDuoResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-organization-duo.response";
import { TwoFactorProviderResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-provider.response";
import { TwoFactorRecoverResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-recover.response";
import { TwoFactorWebAuthnChallengeResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-web-authn-challenge.response";
import { TwoFactorWebAuthnDeleteResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-web-authn-delete.response";
import { TwoFactorWebAuthnUpdateResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-web-authn-update.response";
import { TwoFactorWebAuthnResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-web-authn.response";
import { TwoFactorYubiKeyUpdateResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-yubi-key-update.response";
import { TwoFactorYubiKeyResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-yubi-key.response";
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
    request: TwoFactorAuthenticatorUpdateRequest,
  ): Promise<TwoFactorAuthenticatorUpdateResponse> {
    const response = await this.apiService.send(
      "PUT",
      "/two-factor/authenticator",
      request,
      true,
      true,
    );
    return new TwoFactorAuthenticatorUpdateResponse(response);
  }

  async deleteTwoFactorAuthenticator(request: TwoFactorAuthenticatorDeleteRequest): Promise<void> {
    await this.apiService.send("DELETE", "/two-factor/authenticator", request, true, false);
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

  async postTwoFactorEmailSetup(request: TwoFactorEmailSetupRequest): Promise<any> {
    return this.apiService.send("POST", "/two-factor/send-email", request, true, false);
  }

  async postTwoFactorEmail(request: TwoFactorEmailLoginRequest): Promise<any> {
    return this.apiService.send("POST", "/two-factor/send-email-login", request, false, false);
  }

  async putTwoFactorEmail(
    request: TwoFactorEmailUpdateRequest,
  ): Promise<TwoFactorEmailUpdateResponse> {
    const response = await this.apiService.send("PUT", "/two-factor/email", request, true, true);
    return new TwoFactorEmailUpdateResponse(response);
  }

  async deleteTwoFactorEmail(request: TwoFactorEmailDeleteRequest): Promise<void> {
    await this.apiService.send("DELETE", "/two-factor/email", request, true, false);
  }

  // Duo

  async getTwoFactorDuo(request: SecretVerificationRequest): Promise<TwoFactorDuoResponse> {
    const response = await this.apiService.send("POST", "/two-factor/get-duo", request, true, true);
    return new TwoFactorDuoResponse(response);
  }

  async getTwoFactorOrganizationDuo(
    organizationId: string,
    request: SecretVerificationRequest,
  ): Promise<TwoFactorOrganizationDuoResponse> {
    const response = await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/two-factor/get-duo`,
      request,
      true,
      true,
    );
    return new TwoFactorOrganizationDuoResponse(response);
  }

  async putTwoFactorDuo(request: TwoFactorDuoUpdateRequest): Promise<TwoFactorDuoUpdateResponse> {
    const response = await this.apiService.send("PUT", "/two-factor/duo", request, true, true);
    return new TwoFactorDuoUpdateResponse(response);
  }

  async deleteTwoFactorDuo(request: TwoFactorDuoDeleteRequest): Promise<void> {
    await this.apiService.send("DELETE", "/two-factor/duo", request, true, false);
  }

  async putTwoFactorOrganizationDuo(
    organizationId: string,
    request: TwoFactorDuoUpdateRequest,
  ): Promise<TwoFactorOrganizationDuoUpdateResponse> {
    const response = await this.apiService.send(
      "PUT",
      `/organizations/${organizationId}/two-factor/duo`,
      request,
      true,
      true,
    );
    return new TwoFactorOrganizationDuoUpdateResponse(response);
  }

  async deleteTwoFactorOrganizationDuo(
    organizationId: string,
    request: TwoFactorOrganizationDuoDeleteRequest,
  ): Promise<void> {
    await this.apiService.send(
      "DELETE",
      `/organizations/${organizationId}/two-factor/duo`,
      request,
      true,
      false,
    );
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
    request: TwoFactorYubiKeyUpdateRequest,
  ): Promise<TwoFactorYubiKeyUpdateResponse> {
    const response = await this.apiService.send("PUT", "/two-factor/yubikey", request, true, true);
    return new TwoFactorYubiKeyUpdateResponse(response);
  }

  async deleteTwoFactorYubiKey(request: TwoFactorYubiKeyDeleteRequest): Promise<void> {
    await this.apiService.send("DELETE", "/two-factor/yubikey", request, true, false);
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
    request: TwoFactorWebAuthnUpdateRequest,
  ): Promise<TwoFactorWebAuthnUpdateResponse> {
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
    return new TwoFactorWebAuthnUpdateResponse(response);
  }

  async deleteTwoFactorWebAuthn(
    request: TwoFactorWebAuthnDeleteRequest,
  ): Promise<TwoFactorWebAuthnDeleteResponse> {
    const response = await this.apiService.send(
      "DELETE",
      "/two-factor/webauthn",
      request,
      true,
      true,
    );
    return new TwoFactorWebAuthnDeleteResponse(response);
  }

  async deleteTwoFactorWebAuthnAll(request: TwoFactorWebAuthnDeleteAllRequest): Promise<void> {
    await this.apiService.send("DELETE", "/two-factor/webauthn/all", request, true, false);
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
