import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DisableTwoFactorAuthenticatorRequest } from "@bitwarden/common/auth/models/request/disable-two-factor-authenticator.request";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { TwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/two-factor-email.request";
import { TwoFactorProviderRequest } from "@bitwarden/common/auth/models/request/two-factor-provider.request";
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
import {
  TwoFactorWebAuthnResponse,
  ChallengeResponse,
} from "@bitwarden/common/auth/models/response/two-factor-web-authn.response";
import { TwoFactorYubiKeyResponse } from "@bitwarden/common/auth/models/response/two-factor-yubi-key.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { TwoFactorApiService } from "./two-factor-api.service";

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
    request: DisableTwoFactorAuthenticatorRequest,
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
  ): Promise<ChallengeResponse> {
    const response = await this.apiService.send(
      "POST",
      "/two-factor/get-webauthn-challenge",
      request,
      true,
      true,
    );
    return new ChallengeResponse(response);
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

  // Disable

  async putTwoFactorDisable(request: TwoFactorProviderRequest): Promise<TwoFactorProviderResponse> {
    const response = await this.apiService.send("PUT", "/two-factor/disable", request, true, true);
    return new TwoFactorProviderResponse(response);
  }

  async putTwoFactorOrganizationDisable(
    organizationId: string,
    request: TwoFactorProviderRequest,
  ): Promise<TwoFactorProviderResponse> {
    const response = await this.apiService.send(
      "PUT",
      `/organizations/${organizationId}/two-factor/disable`,
      request,
      true,
      true,
    );
    return new TwoFactorProviderResponse(response);
  }
}
