import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "../../../abstractions/api.service";
import { ListResponse } from "../../../models/response/list.response";
import { SecretVerificationRequest } from "../../models/request/secret-verification.request";
import { TwoFactorAuthenticatorDeleteRequest } from "../request/two-factor-authenticator-delete.request";
import { TwoFactorAuthenticatorUpdateRequest } from "../request/two-factor-authenticator-update.request";
import { TwoFactorDuoDeleteRequest } from "../request/two-factor-duo-delete.request";
import { TwoFactorDuoUpdateRequest } from "../request/two-factor-duo-update.request";
import { TwoFactorEmailDeleteRequest } from "../request/two-factor-email-delete.request";
import { TwoFactorEmailLoginRequest } from "../request/two-factor-email-login.request";
import { TwoFactorEmailSetupRequest } from "../request/two-factor-email-setup.request";
import { TwoFactorEmailUpdateRequest } from "../request/two-factor-email-update.request";
import { TwoFactorOrganizationDuoDeleteRequest } from "../request/two-factor-organization-duo-delete.request";
import { TwoFactorWebAuthnChallengeRequest } from "../request/two-factor-web-authn-challenge.request";
import { TwoFactorWebAuthnDeleteAllRequest } from "../request/two-factor-web-authn-delete-all.request";
import { TwoFactorWebAuthnDeleteRequest } from "../request/two-factor-web-authn-delete.request";
import { TwoFactorWebAuthnUpdateRequest } from "../request/two-factor-web-authn-update.request";
import { TwoFactorYubiKeyDeleteRequest } from "../request/two-factor-yubikey-delete.request";
import { TwoFactorYubiKeyUpdateRequest } from "../request/two-factor-yubikey-update.request";
import { TwoFactorAuthenticatorUpdateResponse } from "../response/two-factor-authenticator-update.response";
import { TwoFactorAuthenticatorResponse } from "../response/two-factor-authenticator.response";
import { TwoFactorDuoUpdateResponse } from "../response/two-factor-duo-update.response";
import { TwoFactorDuoResponse } from "../response/two-factor-duo.response";
import { TwoFactorEmailUpdateResponse } from "../response/two-factor-email-update.response";
import { TwoFactorEmailResponse } from "../response/two-factor-email.response";
import { TwoFactorOrganizationDuoUpdateResponse } from "../response/two-factor-organization-duo-update.response";
import { TwoFactorOrganizationDuoResponse } from "../response/two-factor-organization-duo.response";
import { TwoFactorProviderResponse } from "../response/two-factor-provider.response";
import { TwoFactorRecoverResponse } from "../response/two-factor-recover.response";
import { TwoFactorWebAuthnChallengeResponse } from "../response/two-factor-web-authn-challenge.response";
import { TwoFactorWebAuthnDeleteResponse } from "../response/two-factor-web-authn-delete.response";
import { TwoFactorWebAuthnUpdateResponse } from "../response/two-factor-web-authn-update.response";
import { TwoFactorWebAuthnResponse } from "../response/two-factor-web-authn.response";
import { TwoFactorYubiKeyUpdateResponse } from "../response/two-factor-yubi-key-update.response";
import { TwoFactorYubiKeyResponse } from "../response/two-factor-yubi-key.response";

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
          Authenticator: {
            Enabled: false,
            Key: "MFRGGZDFMZTWQ2LK",
          },
          UserVerificationToken: "uv-token",
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
        expect(result.authenticator.enabled).toBe(false);
        expect(result.authenticator.key).toBe("MFRGGZDFMZTWQ2LK");
        expect(result.userVerificationToken).toBe("uv-token");
      });
    });

    describe("putTwoFactorAuthenticator", () => {
      it("enables authenticator after validating the provided token", async () => {
        const request = new TwoFactorAuthenticatorUpdateRequest("123456", "MFRGGZDFMZTWQ2LK", "");
        const mockResponse = {
          Authenticator: {
            Enabled: true,
            Key: "MFRGGZDFMZTWQ2LK",
          },
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
        expect(result).toBeInstanceOf(TwoFactorAuthenticatorUpdateResponse);
        expect(result.authenticator.enabled).toBe(true);
        expect(result.authenticator.key).toBeDefined();
      });
    });

    describe("deleteTwoFactorAuthenticator", () => {
      it("disables authenticator two-factor authentication and expects no body", async () => {
        const request = new TwoFactorAuthenticatorDeleteRequest("MFRGGZDFMZTWQ2LK", "uv-token");

        await twoFactorApiService.deleteTwoFactorAuthenticator(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "DELETE",
          "/two-factor/authenticator",
          request,
          true,
          false,
        );
      });
    });
  });

  describe("Email APIs", () => {
    describe("getTwoFactorEmail", () => {
      it("retrieves email two-factor configuration after user verification", async () => {
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Email: {
            Enabled: true,
            Email: "user@example.com",
          },
          UserVerificationToken: "uv-token",
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
        expect(result.email.enabled).toBe(true);
        expect(result.email.email).toBe("user@example.com");
        expect(result.userVerificationToken).toBe("uv-token");
      });
    });

    describe("postTwoFactorEmailSetup", () => {
      it("sends verification code to email address during two-factor setup", async () => {
        const request = new TwoFactorEmailSetupRequest(
          "user@example.com",
          "user-verification-token",
        );

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
        const request = new TwoFactorEmailLoginRequest();
        request.email = "user@example.com";

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
        const request = new TwoFactorEmailUpdateRequest(
          "verification-code",
          "user@example.com",
          "",
        );
        const mockResponse = {
          Email: {
            Enabled: true,
            Email: "user@example.com",
          },
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
        expect(result).toBeInstanceOf(TwoFactorEmailUpdateResponse);
        expect(result.email.enabled).toBe(true);
        expect(result.email.email).toBe("user@example.com");
      });
    });
  });

  describe("Duo APIs", () => {
    describe("getTwoFactorDuo", () => {
      it("retrieves Duo configuration for premium user after verification", async () => {
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Duo: {
            Enabled: true,
            Host: "api-abc123.duosecurity.com",
            ClientId: "DI9ABC1DEFGH2JKL",
            ClientSecret: "client******",
          },
          UserVerificationToken: "uv-token",
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
        expect(result.duo.enabled).toBe(true);
        expect(result.duo.host).toBe("api-abc123.duosecurity.com");
        expect(result.duo.clientId).toBe("DI9ABC1DEFGH2JKL");
        expect(result.duo.clientSecret).toContain("******");
        expect(result.userVerificationToken).toBe("uv-token");
      });
    });

    describe("getTwoFactorOrganizationDuo", () => {
      it("retrieves Duo configuration for organization with admin permissions", async () => {
        const organizationId = "org-123";
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          Duo: {
            Enabled: true,
            Host: "api-xyz789.duosecurity.com",
            ClientId: "DI4XYZ9MNOP3QRS",
            ClientSecret: "orgcli******",
          },
          UserVerificationToken: "uv-token",
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
        expect(result).toBeInstanceOf(TwoFactorOrganizationDuoResponse);
        expect(result.duo.enabled).toBe(true);
        expect(result.duo.host).toBe("api-xyz789.duosecurity.com");
        expect(result.duo.clientId).toBe("DI4XYZ9MNOP3QRS");
        expect(result.duo.clientSecret).toContain("******");
        expect(result.userVerificationToken).toBe("uv-token");
      });
    });

    describe("putTwoFactorDuo", () => {
      it("enables Duo two-factor for premium user with valid integration details", async () => {
        const request = new TwoFactorDuoUpdateRequest(
          "DI9ABC1DEFGH2JKL",
          "client-secret-value-here",
          "api-abc123.duosecurity.com",
          "",
        );
        const mockResponse = {
          Duo: {
            Enabled: true,
            Host: "api-abc123.duosecurity.com",
            ClientId: "DI9ABC1DEFGH2JKL",
            ClientSecret: "client******",
          },
        };
        apiService.send.mockResolvedValue(mockResponse);

        const result = await twoFactorApiService.putTwoFactorDuo(request);

        expect(apiService.send).toHaveBeenCalledWith("PUT", "/two-factor/duo", request, true, true);
        expect(result).toBeInstanceOf(TwoFactorDuoUpdateResponse);
        expect(result.duo.enabled).toBe(true);
        expect(result.duo.host).toBeDefined();
        expect(result.duo.clientId).toBeDefined();
        expect(result.duo.clientSecret).toContain("******");
      });
    });

    describe("putTwoFactorOrganizationDuo", () => {
      it("enables organization-level Duo with policy management permissions", async () => {
        const organizationId = "org-123";
        const request = new TwoFactorDuoUpdateRequest(
          "DI4XYZ9MNOP3QRS",
          "orgcli-secret-value-here",
          "api-xyz789.duosecurity.com",
          "",
        );
        const mockResponse = {
          Duo: {
            Enabled: true,
            Host: "api-xyz789.duosecurity.com",
            ClientId: "DI4XYZ9MNOP3QRS",
            ClientSecret: "orgcli******",
          },
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
        expect(result).toBeInstanceOf(TwoFactorOrganizationDuoUpdateResponse);
        expect(result.duo.enabled).toBe(true);
        expect(result.duo.host).toBeDefined();
        expect(result.duo.clientId).toBeDefined();
        expect(result.duo.clientSecret).toContain("******");
      });
    });
  });

  describe("YubiKey APIs", () => {
    describe("getTwoFactorYubiKey", () => {
      it("retrieves YubiKey configuration for premium user after verification", async () => {
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          YubiKey: {
            Enabled: true,
            Key1: "cccccccccccc",
            Key2: "dddddddddddd",
          },
          UserVerificationToken: "uv-token",
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
        expect(result.yubiKey.enabled).toBe(true);
        expect(result.yubiKey.key1).toBe("cccccccccccc");
        expect(result.yubiKey.key2).toBe("dddddddddddd");
        expect(result.userVerificationToken).toBe("uv-token");
      });
    });

    describe("putTwoFactorYubiKey", () => {
      it("enables YubiKey two-factor for premium user after validating device OTPs", async () => {
        const request = new TwoFactorYubiKeyUpdateRequest(
          "ccccccccccccjkhbhbhrkcitringjkrjirfjuunlnlvcghnkrtgfj",
          "ddddddddddddvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
          "",
          "",
          "",
          false,
          "",
        );
        const mockResponse = {
          YubiKey: {
            Enabled: true,
            Key1: "cccccccccccc",
            Key2: "dddddddddddd",
            Nfc: false,
          },
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
        expect(result).toBeInstanceOf(TwoFactorYubiKeyUpdateResponse);
        expect(result.yubiKey.enabled).toBe(true);
        expect(result.yubiKey.key1).toBeDefined();
        expect(result.yubiKey.key2).toBeDefined();
      });
    });
  });

  describe("WebAuthn APIs", () => {
    describe("getTwoFactorWebAuthn", () => {
      it("retrieves list of registered WebAuthn credentials after verification", async () => {
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = "master-password-hash";
        const mockResponse = {
          WebAuthn: {
            Enabled: true,
            Keys: [
              { Name: "YubiKey 5", Id: 1, Migrated: false },
              { Name: "Security Key", Id: 2, Migrated: true },
            ],
          },
          UserVerificationToken: "uv-token",
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
        expect(result.webAuthn.enabled).toBe(true);
        expect(result.webAuthn.keys).toHaveLength(2);
        result.webAuthn.keys.forEach((key) => {
          expect(key).toHaveProperty("name");
          expect(key).toHaveProperty("id");
          expect(key).toHaveProperty("migrated");
        });
        expect(result.userVerificationToken).toBe("uv-token");
      });
    });

    describe("getTwoFactorWebAuthnChallenge", () => {
      it("replays the cached user-verification token and obtains the wrapped challenge", async () => {
        const request = new TwoFactorWebAuthnChallengeRequest("uv-token");
        const mockResponse = {
          Options: {
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
          },
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
        expect(result).toBeInstanceOf(TwoFactorWebAuthnChallengeResponse);
        expect(result.options).toBeDefined();
        expect(result.options.challenge).toBeDefined();
        expect(result.options.rp).toHaveProperty("name", "Bitwarden");
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

        const request = new TwoFactorWebAuthnUpdateRequest(
          mockCredential as PublicKeyCredential,
          "My Security Key",
          0,
          "",
        );

        const mockResponse = {
          WebAuthn: {
            Enabled: true,
            Keys: [{ Name: "My Security Key", Id: 1, Migrated: false }],
          },
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
        expect(result).toBeInstanceOf(TwoFactorWebAuthnUpdateResponse);
        expect(result.webAuthn.enabled).toBe(true);
        expect(result.webAuthn.keys).toHaveLength(1);
        expect(result.webAuthn.keys[0].name).toBeDefined();
        expect(result.webAuthn.keys[0].id).toBeDefined();
        expect(result.webAuthn.keys[0].migrated).toBeDefined();
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

        const request = new TwoFactorWebAuthnUpdateRequest(
          mockCredential as PublicKeyCredential,
          "My Security Key",
          0,
          "",
        );

        const originalDeviceResponse = request.deviceResponse;
        apiService.send.mockResolvedValue({ WebAuthn: { Enabled: true, Keys: [] } });

        await twoFactorApiService.putTwoFactorWebAuthn(request);

        // Do not mutate the original request object
        expect(request.deviceResponse).toBe(originalDeviceResponse);
        expect(request.deviceResponse.response).toBe(mockAttestationResponse);
      });
    });

    describe("deleteTwoFactorWebAuthn", () => {
      it("removes specific WebAuthn credential while preserving other registered keys", async () => {
        const request = new TwoFactorWebAuthnDeleteRequest(1, "uv-token");
        const mockResponse = {
          WebAuthn: {
            Enabled: true,
            Keys: [{ Name: "Security Key", Id: 2, Migrated: true }], // Key with id:1 removed
          },
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
        expect(result).toBeInstanceOf(TwoFactorWebAuthnDeleteResponse);
        expect(result.webAuthn.keys).toHaveLength(1);
        expect(result.webAuthn.keys[0].id).toBe(2);
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

  describe("Per-provider Delete APIs", () => {
    describe("deleteTwoFactorYubiKey", () => {
      it("removes YubiKey two-factor enrollment for the current user and expects no body", async () => {
        const request = new TwoFactorYubiKeyDeleteRequest("uv-token");

        await twoFactorApiService.deleteTwoFactorYubiKey(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "DELETE",
          "/two-factor/yubikey",
          request,
          true,
          false,
        );
      });
    });

    describe("deleteTwoFactorDuo", () => {
      it("removes Duo two-factor enrollment for the current user and expects no body", async () => {
        const request = new TwoFactorDuoDeleteRequest("uv-token");

        await twoFactorApiService.deleteTwoFactorDuo(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "DELETE",
          "/two-factor/duo",
          request,
          true,
          false,
        );
      });
    });

    describe("deleteTwoFactorEmail", () => {
      it("removes email two-factor enrollment for the current user and expects no body", async () => {
        const request = new TwoFactorEmailDeleteRequest("uv-token");

        await twoFactorApiService.deleteTwoFactorEmail(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "DELETE",
          "/two-factor/email",
          request,
          true,
          false,
        );
      });
    });

    describe("deleteTwoFactorOrganizationDuo", () => {
      it("removes Duo two-factor enrollment for an organization and expects no body", async () => {
        const organizationId = "org-123";
        const request = new TwoFactorOrganizationDuoDeleteRequest("uv-token");

        await twoFactorApiService.deleteTwoFactorOrganizationDuo(organizationId, request);

        expect(apiService.send).toHaveBeenCalledWith(
          "DELETE",
          `/organizations/${organizationId}/two-factor/duo`,
          request,
          true,
          false,
        );
      });
    });

    describe("deleteTwoFactorWebAuthnAll", () => {
      it("removes the entire WebAuthn enrollment in a single round-trip and expects no body", async () => {
        const request = new TwoFactorWebAuthnDeleteAllRequest("uv-token");

        await twoFactorApiService.deleteTwoFactorWebAuthnAll(request);

        expect(apiService.send).toHaveBeenCalledWith(
          "DELETE",
          "/two-factor/webauthn/all",
          request,
          true,
          false,
        );
      });
    });
  });
});
