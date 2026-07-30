import { mock, MockProxy } from "jest-mock-extended";

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

import { DefaultTwoFactorApiService } from "./default-two-factor-api.service";

describe("TwoFactorApiService", () => {
  let apiService: MockProxy<ApiService>;
  let twoFactorApiService: DefaultTwoFactorApiService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    twoFactorApiService = new DefaultTwoFactorApiService(apiService);
  });

  describe("Two-Factor Providers", () => {
    describe("getTwoFactorProviders", () => {
      it("retrieves all enabled two-factor providers for the current user", async () => {
        const mockResponse = {
          data: [
            { Type: 0, Enabled: true },
            { Type: 1, Enabled: true },
          ],
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.getTwoFactorProviders();

        expect(apiService.send).toHaveBeenCalledWith("GET", "/two-factor", null, true, true);
        expect(result).toBeInstanceOf(ListResponse);
        expect(result.data).toHaveLength(2);
        for (let i = 0; i < result.data.length; i++) {
          expect(result.data[i]).toBeInstanceOf(TwoFactorProviderResponse);
          expect(result.data[i].type).toBe(i);
          expect(result.data[i].enabled).toBe(true);
        }
      });
    });

    describe("getTwoFactorOrganizationProviders", () => {
      it("retrieves all enabled two-factor providers for a specific organization", async () => {
        const organizationId = "org-123";
        const mockResponse = {
          data: [{ Type: 6, Enabled: true }],
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.getTwoFactorOrganizationProviders(organizationId);

        expect(apiService.send).toHaveBeenCalledWith(
          "GET",
          `/organizations/${organizationId}/two-factor`,
          null,
          true,
          true,
        );
        expect(result).toBeInstanceOf(ListResponse);
        expect(result.data[0]).toBeInstanceOf(TwoFactorProviderResponse);
        expect(result.data[0].enabled).toBe(true);
        expect(result.data[0].type).toBe(6); // Duo
      });
    });
  });

  describe("Authenticator (TOTP) APIs", () => {
    describe("getTwoFactorAuthenticator", () => {
      it("retrieves authenticator configuration with secret key after user verification", async () => {
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Enabled: false,
          Key: "MFRGGZDFMZTWQ2LK",
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.getTwoFactorAuthenticator(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/two-factor/get-authenticator",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorAuthenticatorResponse);
        expect(result.enabled).toBe(false);
      });
    });

    describe("putTwoFactorAuthenticator", () => {
      it("enables authenticator after validating the provided token", async () => {
        const request = new UpdateTwoFactorAuthenticatorRequest();
        request.token = "123456";
        request.key = "MFRGGZDFMZTWQ2LK";
        const mockResponse = {
          Enabled: true,
          Key: "MFRGGZDFMZTWQ2LK",
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.putTwoFactorAuthenticator(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "PUT",
          "/two-factor/authenticator",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorAuthenticatorResponse);
        expect(result.enabled).toBe(true);
        expect(result.key).toBeDefined();
      });
    });

    describe("deleteTwoFactorAuthenticator", () => {
      it("disables authenticator two-factor authentication", async () => {
        const request = new DisableTwoFactorAuthenticatorRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Enabled: false,
          Type: 0,
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.deleteTwoFactorAuthenticator(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "DELETE",
          "/two-factor/authenticator",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorProviderResponse);
        expect(result.enabled).toBe(false);
        expect(result.type).toBe(0); // Authenticator
      });
    });
  });

  describe("Email APIs", () => {
    describe("getTwoFactorEmail", () => {
      it("retrieves email two-factor configuration after user verification", async () => {
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Enabled: true,
          Email: "user@example.com",
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.getTwoFactorEmail(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/two-factor/get-email",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorEmailResponse);
        expect(result.enabled).toBe(true);
        expect(result.email).toBeDefined();
      });
    });

    describe("postTwoFactorEmailSetup", () => {
      it("sends verification code to email address during two-factor setup", async () => {
        const request = new TwoFactorEmailRequest();
        request.email = "user@example.com";
        request.masterPasswordHash = "master-password-hash";

        await twoFactorApiService.postTwoFactorEmailSetup(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/two-factor/send-email",
          request,
          true,
          false,
        );
      });
    });

    describe("postTwoFactorEmail", () => {
      it("sends two-factor authentication code during login flow", async () => {
        const request = new TwoFactorEmailRequest();
        request.email = "user@example.com";
        // Note: masterPasswordHash not required for login flow

        await twoFactorApiService.postTwoFactorEmail(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/two-factor/send-email-login",
          request,
          false,
          false,
        );
      });
    });

    describe("putTwoFactorEmail", () => {
      it("enables email two-factor after validating the verification code", async () => {
        const request = new UpdateTwoFactorEmailRequest();
        request.email = "user@example.com";
        request.token = "verification-code";
        const mockResponse = {
          Enabled: true,
          Email: "user@example.com",
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.putTwoFactorEmail(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "PUT",
          "/two-factor/email",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorEmailResponse);
        expect(result.enabled).toBe(true);
        expect(result.email).toBeDefined();
      });
    });
  });

  describe("Duo APIs", () => {
    describe("getTwoFactorDuo", () => {
      it("retrieves Duo configuration for premium user after verification", async () => {
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Enabled: true,
          Host: "api-abc123.duosecurity.com",
          ClientId: "DI9ABC1DEFGH2JKL",
          ClientSecret: "client******",
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.getTwoFactorDuo(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/two-factor/get-duo",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorDuoResponse);
        expect(result.enabled).toBe(true);
        expect(result.host).toBeDefined();
        expect(result.clientId).toBeDefined();
        expect(result.clientSecret).toContain("******");
      });
    });

    describe("getTwoFactorOrganizationDuo", () => {
      it("retrieves Duo configuration for organization with admin permissions", async () => {
        const organizationId = "org-123";
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Enabled: true,
          Host: "api-xyz789.duosecurity.com",
          ClientId: "DI4XYZ9MNOP3QRS",
          ClientSecret: "orgcli******",
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.getTwoFactorOrganizationDuo(
          organizationId,
          request,
        );

        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          `/organizations/${organizationId}/two-factor/get-duo`,
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorDuoResponse);
        expect(result.enabled).toBe(true);
        expect(result.host).toBeDefined();
        expect(result.clientId).toBeDefined();
        expect(result.clientSecret).toContain("******");
      });
    });

    describe("putTwoFactorDuo", () => {
      it("enables Duo two-factor for premium user with valid integration details", async () => {
        const request = new UpdateTwoFactorDuoRequest();
        request.host = "api-abc123.duosecurity.com";
        request.clientId = "DI9ABC1DEFGH2JKL";
        request.clientSecret = "client-secret-value-here";
        const mockResponse = {
          Enabled: true,
          Host: "api-abc123.duosecurity.com",
          ClientId: "DI9ABC1DEFGH2JKL",
          ClientSecret: "client******",
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.putTwoFactorDuo(request);

        expect(apiService.send).toHaveBeenCalledWith("PUT", "/two-factor/duo", request, true, true);
        expect(result).toBeInstanceOf(TwoFactorDuoResponse);
        expect(result.enabled).toBe(true);
        expect(result.host).toBeDefined();
        expect(result.clientId).toBeDefined();
        expect(result.clientSecret).toContain("******");
      });
    });

    describe("putTwoFactorOrganizationDuo", () => {
      it("enables organization-level Duo with policy management permissions", async () => {
        const organizationId = "org-123";
        const request = new UpdateTwoFactorDuoRequest();
        request.host = "api-xyz789.duosecurity.com";
        request.clientId = "DI4XYZ9MNOP3QRS";
        request.clientSecret = "orgcli-secret-value-here";
        const mockResponse = {
          Enabled: true,
          Host: "api-xyz789.duosecurity.com",
          ClientId: "DI4XYZ9MNOP3QRS",
          ClientSecret: "orgcli******",
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.putTwoFactorOrganizationDuo(
          organizationId,
          request,
        );

        expect(apiService.send).toHaveBeenCalledWith(
          "PUT",
          `/organizations/${organizationId}/two-factor/duo`,
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorDuoResponse);
        expect(result.enabled).toBe(true);
        expect(result.host).toBeDefined();
        expect(result.clientId).toBeDefined();
        expect(result.clientSecret).toContain("******");
      });
    });
  });

  describe("YubiKey APIs", () => {
    describe("getTwoFactorYubiKey", () => {
      it("retrieves YubiKey configuration for premium user after verification", async () => {
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Enabled: true,
          Key1: "cccccccccccc",
          Key2: "dddddddddddd",
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.getTwoFactorYubiKey(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/two-factor/get-yubikey",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorYubiKeyResponse);
        expect(result.enabled).toBe(true);
        expect(result.key1).toBeDefined();
        expect(result.key2).toBeDefined();
      });
    });

    describe("putTwoFactorYubiKey", () => {
      it("enables YubiKey two-factor for premium user after validating device OTPs", async () => {
        const request = new UpdateTwoFactorYubikeyOtpRequest();
        request.key1 = "ccccccccccccjkhbhbhrkcitringjkrjirfjuunlnlvcghnkrtgfj";
        request.key2 = "ddddddddddddvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv";
        const mockResponse = {
          Enabled: true,
          Key1: "cccccccccccc",
          Key2: "dddddddddddd",
          Nfc: false,
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.putTwoFactorYubiKey(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "PUT",
          "/two-factor/yubikey",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorYubiKeyResponse);
        expect(result.enabled).toBe(true);
        expect(result.key1).toBeDefined();
        expect(result.key2).toBeDefined();
      });
    });
  });

  describe("WebAuthn APIs", () => {
    describe("getTwoFactorWebAuthn", () => {
      it("retrieves list of registered WebAuthn credentials after verification", async () => {
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Enabled: true,
          Keys: [
            { Name: "YubiKey 5", Id: 1, Migrated: false },
            { Name: "Security Key", Id: 2, Migrated: true },
          ],
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.getTwoFactorWebAuthn(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/two-factor/get-webauthn",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorWebAuthnResponse);
        expect(result.enabled).toBe(true);
        expect(result.keys).toHaveLength(2);
        result.keys.forEach((key) => {
          expect(key).toHaveProperty("name");
          expect(key).toHaveProperty("id");
          expect(key).toHaveProperty("migrated");
        });
      });
    });

    describe("getTwoFactorWebAuthnChallenge", () => {
      it("obtains cryptographic challenge for WebAuthn credential registration", async () => {
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          challenge: "Y2hhbGxlbmdlLXN0cmluZw",
          rp: { name: "Bitwarden" },
          user: {
            id: "dXNlci1pZA",
            name: "user@example.com",
            displayName: "User",
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
          excludeCredentials: [] as PublicKeyCredentialDescriptor[],
          timeout: 60000,
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.getTwoFactorWebAuthnChallenge(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/two-factor/get-webauthn-challenge",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(ChallengeResponse);
        expect(result.challenge).toBeDefined();
        expect(result.rp).toHaveProperty("name", "Bitwarden");
        expect(result.user).toHaveProperty("id");
        expect(result.user).toHaveProperty("name");
        expect(result.user).toHaveProperty("displayName", "User");
        expect(result.pubKeyCredParams).toHaveLength(1);
        expect(Number(result.timeout)).toBeTruthy();
      });
    });

    describe("putTwoFactorWebAuthn", () => {
      it("registers new WebAuthn credential by serializing browser credential to JSON", async () => {
        const mockAttestationResponse: Partial<AuthenticatorAttestationResponse> = {
          clientDataJSON: new Uint8Array([1, 2, 3]).buffer,
          attestationObject: new Uint8Array([4, 5, 6]).buffer,
        };

        const mockCredential: Partial<PublicKeyCredential> = {
          id: "credential-id",
          type: "public-key",
          response: mockAttestationResponse as AuthenticatorAttestationResponse,
          getClientExtensionResults: jest.fn().mockReturnValue({}),
        };

        const request = new UpdateTwoFactorWebAuthnRequest();
        request.deviceResponse = mockCredential as PublicKeyCredential;
        request.name = "My Security Key";

        const mockResponse = {
          Enabled: true,
          Keys: [{ Name: "My Security Key", Id: 1, Migrated: false }],
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.putTwoFactorWebAuthn(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "PUT",
          "/two-factor/webauthn",
          expect.objectContaining({
            name: "My Security Key",
            deviceResponse: expect.objectContaining({
              id: "credential-id",
              rawId: expect.any(String), // base64 encoded
              type: "public-key",
              extensions: {},
              response: expect.objectContaining({
                AttestationObject: expect.any(String), // base64 encoded
                clientDataJson: expect.any(String), // base64 encoded
              }),
            }),
          }),
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorWebAuthnResponse);
        expect(result.enabled).toBe(true);
        expect(result.keys).toHaveLength(1);
        expect(result.keys[0].name).toBeDefined();
        expect(result.keys[0].id).toBeDefined();
        expect(result.keys[0].migrated).toBeDefined();
      });

      it("preserves original request object without mutation during serialization", async () => {
        const mockAttestationResponse: Partial<AuthenticatorAttestationResponse> = {
          clientDataJSON: new Uint8Array([1, 2, 3]).buffer,
          attestationObject: new Uint8Array([4, 5, 6]).buffer,
        };

        const mockCredential: Partial<PublicKeyCredential> = {
          id: "credential-id",
          type: "public-key",
          response: mockAttestationResponse as AuthenticatorAttestationResponse,
          getClientExtensionResults: jest.fn().mockReturnValue({}),
        };

        const request = new UpdateTwoFactorWebAuthnRequest();
        request.deviceResponse = mockCredential as PublicKeyCredential;
        request.name = "My Security Key";

        const originalDeviceResponse = request.deviceResponse;
        apiService.send.mockResolvedValue({ enabled: true, keys: [] });

        await twoFactorApiService.putTwoFactorWebAuthn(request);

        // Do not mutate the original request object
        expect(request.deviceResponse).toBe(originalDeviceResponse);
        expect(request.deviceResponse.response).toBe(mockAttestationResponse);
      });
    });

    describe("deleteTwoFactorWebAuthn", () => {
      it("removes specific WebAuthn credential while preserving other registered keys", async () => {
        const request = new UpdateTwoFactorWebAuthnDeleteRequest();
        request.id = 1;
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Enabled: true,
          Keys: [{ Name: "Security Key", Id: 2, Migrated: true }], // Key with id:1 removed
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.deleteTwoFactorWebAuthn(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "DELETE",
          "/two-factor/webauthn",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorWebAuthnResponse);
        expect(result.keys).toHaveLength(1);
        expect(result.keys[0].id).toBe(2);
      });
    });
  });

  describe("Recovery Code APIs", () => {
    describe("getTwoFactorRecover", () => {
      it("retrieves recovery code for regaining access when two-factor is unavailable", async () => {
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Code: "ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ12",
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.getTwoFactorRecover(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/two-factor/get-recover",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorRecoverResponse);
        expect(result.code).toBeDefined();
        expect(result.code).toMatch(/^[A-Z0-9-]+$/);
      });
    });
  });

  describe("Disable APIs", () => {
    describe("putTwoFactorDisable", () => {
      it("disables specified two-factor provider for current user", async () => {
        const request = new TwoFactorProviderRequest();
        request.type = 0; // Authenticator
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Enabled: false,
          Type: 0,
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.putTwoFactorDisable(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "PUT",
          "/two-factor/disable",
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorProviderResponse);
        expect(result.enabled).toBe(false);
        expect(result.type).toBe(0); // Authenticator
      });
    });

    describe("putTwoFactorOrganizationDisable", () => {
      it("disables two-factor provider for organization with policy management permissions", async () => {
        const organizationId = "org-123";
        const request = new TwoFactorProviderRequest();
        request.type = 6; // Duo
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Enabled: false,
          Type: 6,
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.putTwoFactorOrganizationDisable(
          organizationId,
          request,
        );

        expect(apiService.send).toHaveBeenCalledWith(
          "PUT",
          `/organizations/${organizationId}/two-factor/disable`,
          request,
          true,
          true,
        );
        expect(result).toBeInstanceOf(TwoFactorProviderResponse);
        expect(result.enabled).toBe(false);
        expect(result.type).toBe(6); // Duo
      });
    });
  });
});
