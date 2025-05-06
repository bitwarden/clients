/**
 * Jest needs to run in custom environment to mock Request/Response objects
 * @jest-environment ../../libs/shared/test.environment.ts
 */

import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ClientType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { DefaultChangeLoginPasswordService } from "./default-change-login-password.service";

describe("DefaultChangeLoginPasswordService", () => {
  let service: DefaultChangeLoginPasswordService;

  let mockShouldNotExistResponse: Response;
  let mockWellKnownResponse: Response;

  const getClientType = jest.fn(() => ClientType.Browser);

  const mockApiService = mock<ApiService>();
  const platformUtilsService = mock<PlatformUtilsService>({
    getClientType,
  });

  beforeEach(() => {
    mockApiService.nativeFetch.mockClear();

    // Default responses to success state
    mockShouldNotExistResponse = new Response("Not Found", { status: 404 });
    mockWellKnownResponse = new Response("OK", { status: 200 });

    mockApiService.nativeFetch.mockImplementation((request) => {
      if (
        request.url.endsWith("resource-that-should-not-exist-whose-status-code-should-not-be-200")
      ) {
        return Promise.resolve(mockShouldNotExistResponse);
      }

      if (request.url.endsWith(".well-known/change-password")) {
        return Promise.resolve(mockWellKnownResponse);
      }

      throw new Error("Unexpected request");
    });
    service = new DefaultChangeLoginPasswordService(mockApiService, platformUtilsService);
  });

  it("should return null for non-login ciphers", async () => {
    const cipher = {
      type: CipherType.Card,
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBeNull();
  });

  it("should return null for logins with no URIs", async () => {
    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), { uris: [] as LoginUriView[] }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBeNull();
  });

  it("should return null for logins with no valid HTTP/HTTPS URIs", async () => {
    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "ftp://example.com" }],
      }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBeNull();
  });

  it("should check the origin for a reliable status code", async () => {
    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://example.com" }],
      }),
    } as CipherView;

    await service.getChangePasswordUrl(cipher);

    expect(mockApiService.nativeFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com/.well-known/resource-that-should-not-exist-whose-status-code-should-not-be-200",
      }),
    );
  });

  it("should attempt to fetch the well-known change password URL", async () => {
    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://example.com" }],
      }),
    } as CipherView;

    await service.getChangePasswordUrl(cipher);

    expect(mockApiService.nativeFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com/.well-known/change-password",
      }),
    );
  });

  it("should return the well-known change password URL when successful at verifying the response", async () => {
    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://example.com" }],
      }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBe("https://example.com/.well-known/change-password");
  });

  it("should return the original URI when unable to verify the response", async () => {
    mockShouldNotExistResponse = new Response("Ok", { status: 200 });

    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://example.com/" }],
      }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBe("https://example.com/");
  });

  it("should return the original URI when the well-known URL is not found", async () => {
    mockWellKnownResponse = new Response("Not Found", { status: 404 });

    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://example.com/" }],
      }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBe("https://example.com/");
  });

  it("should try the next URI if the first one fails", async () => {
    mockApiService.nativeFetch.mockImplementation((request) => {
      if (
        request.url.endsWith("resource-that-should-not-exist-whose-status-code-should-not-be-200")
      ) {
        return Promise.resolve(mockShouldNotExistResponse);
      }

      if (request.url.endsWith(".well-known/change-password")) {
        if (request.url.includes("working.com")) {
          return Promise.resolve(mockWellKnownResponse);
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      }

      throw new Error("Unexpected request");
    });

    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://no-wellknown.com/" }, { uri: "https://working.com/" }],
      }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBe("https://working.com/.well-known/change-password");
  });

  it("should return the first URI when the client type is not browser", async () => {
    getClientType.mockReturnValue(ClientType.Web);

    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://example.com/" }, { uri: "https://example-2.com/" }],
      }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(mockApiService.nativeFetch).not.toHaveBeenCalled();
    expect(url).toBe("https://example.com/");
  });
});
