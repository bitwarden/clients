import { mock, MockProxy } from "jest-mock-extended";
import { ObservedValueOf, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "@bitwarden/auth/common";
import { UserId } from "@bitwarden/user-core";

import { AccountService } from "../auth/abstractions/account.service";
import { TokenService } from "../auth/abstractions/token.service";
import { DeviceType } from "../enums";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "../key-management/vault-timeout";
import { ErrorResponse } from "../models/response/error.response";
import { AppIdService } from "../platform/abstractions/app-id.service";
import { Environment, EnvironmentService } from "../platform/abstractions/environment.service";
import { LogService } from "../platform/abstractions/log.service";
import { PlatformUtilsService } from "../platform/abstractions/platform-utils.service";

import { InsecureUrlNotAllowedError } from "./api-errors";
import { ApiService, HttpOperations } from "./api.service";

describe("ApiService", () => {
  let tokenService: MockProxy<TokenService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let environmentService: MockProxy<EnvironmentService>;
  let appIdService: MockProxy<AppIdService>;
  let refreshAccessTokenErrorCallback: jest.Mock<void, []>;
  let logService: MockProxy<LogService>;
  let logoutCallback: jest.Mock<Promise<void>, [reason: LogoutReason]>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let accountService: MockProxy<AccountService>;
  let httpOperations: MockProxy<HttpOperations>;

  let sut: ApiService;

  const testActiveUser = "activeUser" as UserId;
  const testInactiveUser = "inactiveUser" as UserId;

  beforeEach(() => {
    tokenService = mock();
    platformUtilsService = mock();
    platformUtilsService.getDevice.mockReturnValue(DeviceType.ChromeExtension);

    environmentService = mock();
    appIdService = mock();
    refreshAccessTokenErrorCallback = jest.fn();
    logService = mock();
    logoutCallback = jest.fn();
    vaultTimeoutSettingsService = mock();
    accountService = mock();

    accountService.activeAccount$ = of({
      id: testActiveUser,
      email: "user1@example.com",
      emailVerified: true,
      name: "Test Name",
    } satisfies ObservedValueOf<AccountService["activeAccount$"]>);

    httpOperations = mock();

    sut = new ApiService(
      tokenService,
      platformUtilsService,
      environmentService,
      appIdService,
      refreshAccessTokenErrorCallback,
      logService,
      logoutCallback,
      vaultTimeoutSettingsService,
      accountService,
      httpOperations,
      "custom-user-agent",
    );
  });

  describe("send", () => {
    it("handles ok GET", async () => {
      environmentService.environment$ = of({
        getApiUrl: () => "https://example.com",
      } satisfies Partial<Environment> as Environment);

      environmentService.getEnvironment$.mockReturnValue(
        of({
          getApiUrl: () => "https://authed.example.com",
        } satisfies Partial<Environment> as Environment),
      );

      httpOperations.createRequest.mockImplementation((url, request) => {
        return {
          url: url,
          cache: request.cache,
          credentials: request.credentials,
          method: request.method,
          mode: request.mode,
          signal: request.signal,
          headers: new Headers(request.headers),
        } satisfies Partial<Request> as unknown as Request;
      });

      tokenService.getAccessToken.mockResolvedValue("access_token");
      tokenService.tokenNeedsRefresh.mockResolvedValue(false);

      const nativeFetch = jest.fn<Promise<Response>, [request: Request]>();

      nativeFetch.mockImplementation((request) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ hello: "world" }),
          headers: new Headers({
            "content-type": "application/json",
          }),
        } satisfies Partial<Response> as Response);
      });

      sut.nativeFetch = nativeFetch;

      const response = await sut.send("GET", "/something", null, true, true, null, null);

      expect(nativeFetch).toHaveBeenCalledTimes(1);
      const request = nativeFetch.mock.calls[0][0];
      expect(request.url).toBe("https://authed.example.com/something");
      // This should get set for users of send
      expect(request.cache).toBe("no-store");
      // TODO: Could expect on the credentials parameter
      expect(request.headers.get("Device-Type")).toBe("2"); // Chrome Extension
      // Custom user agent should get set
      expect(request.headers.get("User-Agent")).toBe("custom-user-agent");
      // This should be set when the caller has indicated there is a response
      expect(request.headers.get("Accept")).toBe("application/json");
      // If they have indicated that it's authed, then the authorization header should get set.
      expect(request.headers.get("Authorization")).toBe("Bearer access_token");
      // The response body
      expect(response).toEqual({ hello: "world" });
    });

    it("authenticates with non-active user when user is passed in", async () => {
      environmentService.environment$ = of({
        getApiUrl: () => "https://example.com",
      } satisfies Partial<Environment> as Environment);

      environmentService.getEnvironment$.calledWith(testInactiveUser).mockReturnValueOnce(
        of({
          getApiUrl: () => "https://inactive.example.com",
        } satisfies Partial<Environment> as Environment),
      );

      httpOperations.createRequest.mockImplementation((url, request) => {
        return {
          url: url,
          cache: request.cache,
          credentials: request.credentials,
          method: request.method,
          mode: request.mode,
          signal: request.signal,
          headers: new Headers(request.headers),
        } satisfies Partial<Request> as unknown as Request;
      });

      tokenService.getAccessToken
        .calledWith(testInactiveUser)
        .mockResolvedValue("inactive_access_token");

      tokenService.tokenNeedsRefresh.calledWith(testInactiveUser).mockResolvedValue(false);

      const nativeFetch = jest.fn<Promise<Response>, [request: Request]>();

      nativeFetch.mockImplementation((request) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ hello: "world" }),
          headers: new Headers({
            "content-type": "application/json",
          }),
        } satisfies Partial<Response> as Response);
      });

      sut.nativeFetch = nativeFetch;

      const response = await sut.send(
        "GET",
        "/something",
        null,
        testInactiveUser,
        true,
        null,
        null,
      );

      expect(nativeFetch).toHaveBeenCalledTimes(1);
      const request = nativeFetch.mock.calls[0][0];
      expect(request.url).toBe("https://inactive.example.com/something");
      // This should get set for users of send
      expect(request.cache).toBe("no-store");
      // TODO: Could expect on the credentials parameter
      expect(request.headers.get("Device-Type")).toBe("2"); // Chrome Extension
      // Custom user agent should get set
      expect(request.headers.get("User-Agent")).toBe("custom-user-agent");
      // This should be set when the caller has indicated there is a response
      expect(request.headers.get("Accept")).toBe("application/json");
      // If they have indicated that it's authed, then the authorization header should get set.
      expect(request.headers.get("Authorization")).toBe("Bearer inactive_access_token");
      // The response body
      expect(response).toEqual({ hello: "world" });
    });

    const cases: {
      name: string;
      authedOrUserId: boolean | UserId;
      expectedEffectiveUser: UserId;
    }[] = [
      {
        name: "refreshes active user when true passed in for auth",
        authedOrUserId: true,
        expectedEffectiveUser: testActiveUser,
      },
      {
        name: "refreshes acess token when the user passed in happens to be the active one",
        authedOrUserId: testActiveUser,
        expectedEffectiveUser: testActiveUser,
      },
      {
        name: "refreshes access token when the user passed in happens to be inactive",
        authedOrUserId: testInactiveUser,
        expectedEffectiveUser: testInactiveUser,
      },
    ];

    it.each(cases)("$name does", async ({ authedOrUserId, expectedEffectiveUser }) => {
      environmentService.getEnvironment$.calledWith(expectedEffectiveUser).mockReturnValue(
        of({
          getApiUrl: () => `https://${expectedEffectiveUser}.example.com`,
          getIdentityUrl: () => `https://${expectedEffectiveUser}.identity.example.com`,
        } satisfies Partial<Environment> as Environment),
      );

      tokenService.getAccessToken
        .calledWith(expectedEffectiveUser)
        .mockResolvedValue(`${expectedEffectiveUser}_access_token`);

      tokenService.tokenNeedsRefresh.calledWith(expectedEffectiveUser).mockResolvedValue(true);

      tokenService.getRefreshToken
        .calledWith(expectedEffectiveUser)
        .mockResolvedValue(`${expectedEffectiveUser}_refresh_token`);

      tokenService.decodeAccessToken
        .calledWith(expectedEffectiveUser)
        .mockResolvedValue({ client_id: "web" });

      tokenService.decodeAccessToken
        .calledWith(`${expectedEffectiveUser}_new_access_token`)
        .mockResolvedValue({ sub: expectedEffectiveUser });

      vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$
        .calledWith(expectedEffectiveUser)
        .mockReturnValue(of(VaultTimeoutAction.Lock));

      vaultTimeoutSettingsService.getVaultTimeoutByUserId$
        .calledWith(expectedEffectiveUser)
        .mockReturnValue(of(VaultTimeoutStringType.Never));

      tokenService.setTokens
        .calledWith(
          `${expectedEffectiveUser}_new_access_token`,
          VaultTimeoutAction.Lock,
          VaultTimeoutStringType.Never,
          `${expectedEffectiveUser}_new_refresh_token`,
        )
        .mockResolvedValue({ accessToken: `${expectedEffectiveUser}_refreshed_access_token` });

      httpOperations.createRequest.mockImplementation((url, request) => {
        return {
          url: url,
          cache: request.cache,
          credentials: request.credentials,
          method: request.method,
          mode: request.mode,
          signal: request.signal,
          headers: new Headers(request.headers),
        } satisfies Partial<Request> as unknown as Request;
      });

      const nativeFetch = jest.fn<Promise<Response>, [request: Request]>();

      nativeFetch.mockImplementation((request) => {
        if (request.url.includes("identity")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                access_token: `${expectedEffectiveUser}_new_access_token`,
                token_type: "Bearer",
                refresh_token: `${expectedEffectiveUser}_new_refresh_token`,
              }),
          } satisfies Partial<Response> as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ hello: "world" }),
          headers: new Headers({
            "content-type": "application/json",
          }),
        } satisfies Partial<Response> as Response);
      });

      sut.nativeFetch = nativeFetch;

      await sut.send("GET", "/something", null, authedOrUserId, true, null, null);

      expect(nativeFetch).toHaveBeenCalledTimes(2);
    });
  });

  const errorData: {
    name: string;
    input: Partial<Response>;
    error: Partial<ErrorResponse>;
  }[] = [
    {
      name: "json response in camel case",
      input: {
        json: () => Promise.resolve({ message: "Something bad happened." }),
        headers: new Headers({
          "content-type": "application/json",
        }),
      },
      error: {
        message: "Something bad happened.",
      },
    },
    {
      name: "json response in pascal case",
      input: {
        json: () => Promise.resolve({ Message: "Something bad happened." }),
        headers: new Headers({
          "content-type": "application/json",
        }),
      },
      error: {
        message: "Something bad happened.",
      },
    },
    {
      name: "json response with charset in content type",
      input: {
        json: () => Promise.resolve({ message: "Something bad happened." }),
        headers: new Headers({
          "content-type": "application/json; charset=utf-8",
        }),
      },
      error: {
        message: "Something bad happened.",
      },
    },
    {
      name: "text/plain response",
      input: {
        text: () => Promise.resolve("Something bad happened."),
        headers: new Headers({
          "content-type": "text/plain",
        }),
      },
      error: {
        message: "Something bad happened.",
      },
    },
  ];

  it.each(errorData)(
    "throws error-like response when not ok response with $name",
    async ({ input, error }) => {
      environmentService.getEnvironment$.calledWith(testActiveUser).mockReturnValue(
        of({
          getApiUrl: () => "https://example.com",
        } satisfies Partial<Environment> as Environment),
      );

      httpOperations.createRequest.mockImplementation((url, request) => {
        return {
          url: url,
          cache: request.cache,
          credentials: request.credentials,
          method: request.method,
          mode: request.mode,
          signal: request.signal,
          headers: new Headers(request.headers),
        } satisfies Partial<Request> as unknown as Request;
      });

      const nativeFetch = jest.fn<Promise<Response>, [request: Request]>();

      nativeFetch.mockImplementation((request) => {
        return Promise.resolve({
          ok: false,
          status: 400,
          ...input,
        } satisfies Partial<Response> as Response);
      });

      sut.nativeFetch = nativeFetch;

      await expect(
        async () => await sut.send("GET", "/something", null, true, true, null, null),
      ).rejects.toMatchObject(error);
    },
  );

  it("throws error when trying to fetch an insecure URL", async () => {
    environmentService.getEnvironment$.calledWith(testActiveUser).mockReturnValue(
      of({
        getApiUrl: () => "http://example.com",
      } satisfies Partial<Environment> as Environment),
    );

    httpOperations.createRequest.mockImplementation((url, request) => {
      return {
        url: url,
        cache: request.cache,
        credentials: request.credentials,
        method: request.method,
        mode: request.mode,
        signal: request.signal ?? undefined,
        headers: new Headers(request.headers),
      } satisfies Partial<Request> as unknown as Request;
    });

    const nativeFetch = jest.fn<Promise<Response>, [request: Request]>();
    nativeFetch.mockImplementation((request) => {
      return Promise.resolve({
        ok: true,
        status: 204,
        headers: new Headers(),
      } satisfies Partial<Response> as Response);
    });
    sut.nativeFetch = nativeFetch;

    await expect(
      async () => await sut.send("GET", "/something", null, true, true, null),
    ).rejects.toThrow(InsecureUrlNotAllowedError);
    expect(nativeFetch).not.toHaveBeenCalled();
  });

  it("retries request with refreshed token when initial request with access token returns 401", async () => {
    // This test verifies the 401 retry flow:
    // 1. Initial request with valid token returns 401 (token expired server-side)
    // 2. After 401, buildRequest is called again, which checks tokenNeedsRefresh
    // 3. tokenNeedsRefresh returns true, triggering refreshToken via getActiveBearerToken
    // 4. refreshToken makes an HTTP call to /connect/token to get new tokens
    // 5. setTokens is called to store the new tokens, returning the refreshed access token
    // 6. Request is retried with the refreshed token and succeeds
    environmentService.getEnvironment$.calledWith(testActiveUser).mockReturnValue(
      of({
        getApiUrl: () => "https://example.com",
        getIdentityUrl: () => "https://identity.example.com",
      } satisfies Partial<Environment> as Environment),
    );

    httpOperations.createRequest.mockImplementation((url, request) => {
      return {
        url: url,
        cache: request.cache,
        credentials: request.credentials,
        method: request.method,
        mode: request.mode,
        signal: request.signal,
        headers: new Headers(request.headers),
      } satisfies Partial<Request> as unknown as Request;
    });
    // getAccessToken returns the same token throughout - the token itself doesn't change,
    // but after the 401, tokenNeedsRefresh will return true, triggering a refresh
    tokenService.getAccessToken.calledWith(testActiveUser).mockResolvedValue("valid_token");
    // First call (initial request): token doesn't need refresh yet
    // Subsequent calls (after 401): token needs refresh, triggering the refresh flow
    tokenService.tokenNeedsRefresh
      .calledWith(testActiveUser)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    tokenService.getRefreshToken
      .calledWith(testActiveUser)
      .mockResolvedValue("valid_refresh_token");

    tokenService.decodeAccessToken
      .calledWith(testActiveUser)
      .mockResolvedValue({ client_id: "web" });

    tokenService.decodeAccessToken
      .calledWith("new_access_token")
      .mockResolvedValue({ sub: testActiveUser });

    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$
      .calledWith(testActiveUser)
      .mockReturnValue(of(VaultTimeoutAction.Lock));

    vaultTimeoutSettingsService.getVaultTimeoutByUserId$
      .calledWith(testActiveUser)
      .mockReturnValue(of(VaultTimeoutStringType.Never));

    tokenService.setTokens
      .calledWith(
        "new_access_token",
        VaultTimeoutAction.Lock,
        VaultTimeoutStringType.Never,
        "new_refresh_token",
      )
      .mockResolvedValue({ accessToken: "refreshed_access_token" });

    const nativeFetch = jest.fn<Promise<Response>, [request: Request]>();
    let callCount = 0;

    nativeFetch.mockImplementation((request) => {
      callCount++;

      // First call: initial request with expired token returns 401
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: "Unauthorized" }),
          headers: new Headers({
            "content-type": "application/json",
          }),
        } satisfies Partial<Response> as Response);
      }

      // Second call: token refresh request
      if (callCount === 2 && request.url.includes("identity")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              access_token: "new_access_token",
              token_type: "Bearer",
              refresh_token: "new_refresh_token",
            }),
        } satisfies Partial<Response> as Response);
      }

      // Third call: retry with refreshed token succeeds
      if (callCount === 3) {
        expect(request.headers.get("Authorization")).toBe("Bearer refreshed_access_token");
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: "success" }),
          headers: new Headers({
            "content-type": "application/json",
          }),
        } satisfies Partial<Response> as Response);
      }

      throw new Error(`Unexpected call #${callCount}: ${request.method} ${request.url}`);
    });

    sut.nativeFetch = nativeFetch;

    const response = await sut.send("GET", "/something", null, true, true, null, null);

    expect(nativeFetch).toHaveBeenCalledTimes(3);
    expect(response).toEqual({ data: "success" });
  });

  it("does not retry when request has no access token and returns 401", async () => {
    environmentService.environment$ = of({
      getApiUrl: () => "https://example.com",
    } satisfies Partial<Environment> as Environment);

    httpOperations.createRequest.mockImplementation((url, request) => {
      return {
        url: url,
        cache: request.cache,
        credentials: request.credentials,
        method: request.method,
        mode: request.mode,
        signal: request.signal,
        headers: new Headers(request.headers),
      } satisfies Partial<Request> as unknown as Request;
    });

    const nativeFetch = jest.fn<Promise<Response>, [request: Request]>();

    nativeFetch.mockImplementation((request) => {
      return Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: "Unauthorized" }),
        headers: new Headers({
          "content-type": "application/json",
        }),
      } satisfies Partial<Response> as Response);
    });

    sut.nativeFetch = nativeFetch;

    await expect(
      async () => await sut.send("GET", "/something", null, false, true, null, null),
    ).rejects.toMatchObject({ message: "Unauthorized" });

    // Should only be called once (no retry)
    expect(nativeFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry when request returns non-401 error", async () => {
    environmentService.getEnvironment$.calledWith(testActiveUser).mockReturnValue(
      of({
        getApiUrl: () => "https://example.com",
        getIdentityUrl: () => "https://identity.example.com",
      } satisfies Partial<Environment> as Environment),
    );

    httpOperations.createRequest.mockImplementation((url, request) => {
      return {
        url: url,
        cache: request.cache,
        credentials: request.credentials,
        method: request.method,
        mode: request.mode,
        signal: request.signal,
        headers: new Headers(request.headers),
      } satisfies Partial<Request> as unknown as Request;
    });

    tokenService.getAccessToken.calledWith(testActiveUser).mockResolvedValue("valid_token");
    tokenService.tokenNeedsRefresh.calledWith(testActiveUser).mockResolvedValue(false);

    const nativeFetch = jest.fn<Promise<Response>, [request: Request]>();

    nativeFetch.mockImplementation((request) => {
      return Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: "Bad Request" }),
        headers: new Headers({
          "content-type": "application/json",
        }),
      } satisfies Partial<Response> as Response);
    });

    sut.nativeFetch = nativeFetch;

    await expect(
      async () => await sut.send("GET", "/something", null, true, true, null, null),
    ).rejects.toMatchObject({ message: "Bad Request" });

    // Should only be called once (no retry for non-401 errors)
    expect(nativeFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry when hasResponse is false", async () => {
    environmentService.environment$ = of({
      getApiUrl: () => "https://example.com",
    } satisfies Partial<Environment> as Environment);

    environmentService.getEnvironment$.calledWith(testActiveUser).mockReturnValue(
      of({
        getApiUrl: () => "https://example.com",
        getIdentityUrl: () => "https://identity.example.com",
      } satisfies Partial<Environment> as Environment),
    );

    httpOperations.createRequest.mockImplementation((url, request) => {
      return {
        url: url,
        cache: request.cache,
        credentials: request.credentials,
        method: request.method,
        mode: request.mode,
        signal: request.signal,
        headers: new Headers(request.headers),
      } satisfies Partial<Request> as unknown as Request;
    });

    tokenService.getAccessToken.calledWith(testActiveUser).mockResolvedValue("expired_token");
    tokenService.tokenNeedsRefresh.calledWith(testActiveUser).mockResolvedValue(false);

    const nativeFetch = jest.fn<Promise<Response>, [request: Request]>();

    nativeFetch.mockImplementation((request) => {
      return Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: "Unauthorized" }),
        headers: new Headers({
          "content-type": "application/json",
        }),
      } satisfies Partial<Response> as Response);
    });

    sut.nativeFetch = nativeFetch;

    // When hasResponse is false, the method should throw even though no retry happens
    await expect(
      async () => await sut.send("POST", "/something", null, true, false, null, null),
    ).rejects.toMatchObject({ message: "Unauthorized" });

    // Should only be called once (no retry when hasResponse is false)
    expect(nativeFetch).toHaveBeenCalledTimes(1);
  });

  it("throws error when retry also returns 401", async () => {
    environmentService.getEnvironment$.calledWith(testActiveUser).mockReturnValue(
      of({
        getApiUrl: () => "https://example.com",
        getIdentityUrl: () => "https://identity.example.com",
      } satisfies Partial<Environment> as Environment),
    );

    httpOperations.createRequest.mockImplementation((url, request) => {
      return {
        url: url,
        cache: request.cache,
        credentials: request.credentials,
        method: request.method,
        mode: request.mode,
        signal: request.signal,
        headers: new Headers(request.headers),
      } satisfies Partial<Request> as unknown as Request;
    });

    // getAccessToken returns the same token throughout - the token itself doesn't change,
    // but after the 401, tokenNeedsRefresh will return true, triggering a refresh
    tokenService.getAccessToken.calledWith(testActiveUser).mockResolvedValue("expired_token");
    // First call (initial request): token doesn't need refresh yet
    // Subsequent calls (after 401): token needs refresh, triggering the refresh flow
    tokenService.tokenNeedsRefresh
      .calledWith(testActiveUser)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    tokenService.getRefreshToken
      .calledWith(testActiveUser)
      .mockResolvedValue("valid_refresh_token");

    tokenService.decodeAccessToken
      .calledWith(testActiveUser)
      .mockResolvedValue({ client_id: "web" });

    tokenService.decodeAccessToken
      .calledWith("new_access_token")
      .mockResolvedValue({ sub: testActiveUser });

    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$
      .calledWith(testActiveUser)
      .mockReturnValue(of(VaultTimeoutAction.Lock));

    vaultTimeoutSettingsService.getVaultTimeoutByUserId$
      .calledWith(testActiveUser)
      .mockReturnValue(of(VaultTimeoutStringType.Never));

    tokenService.setTokens
      .calledWith(
        "new_access_token",
        VaultTimeoutAction.Lock,
        VaultTimeoutStringType.Never,
        "new_refresh_token",
      )
      .mockResolvedValue({ accessToken: "refreshed_access_token" });

    const nativeFetch = jest.fn<Promise<Response>, [request: Request]>();
    let callCount = 0;

    nativeFetch.mockImplementation((request) => {
      callCount++;

      // First call: initial request with expired token returns 401
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: "Unauthorized" }),
          headers: new Headers({
            "content-type": "application/json",
          }),
        } satisfies Partial<Response> as Response);
      }

      // Second call: token refresh request
      if (callCount === 2 && request.url.includes("identity")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              access_token: "new_access_token",
              token_type: "Bearer",
              refresh_token: "new_refresh_token",
            }),
        } satisfies Partial<Response> as Response);
      }

      // Third call: retry with refreshed token still returns 401 (user no longer has permission)
      if (callCount === 3) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: "Still Unauthorized" }),
          headers: new Headers({
            "content-type": "application/json",
          }),
        } satisfies Partial<Response> as Response);
      }

      throw new Error("Unexpected call");
    });

    sut.nativeFetch = nativeFetch;

    await expect(
      async () => await sut.send("GET", "/something", null, true, true, null, null),
    ).rejects.toMatchObject({ message: "Still Unauthorized" });

    expect(nativeFetch).toHaveBeenCalledTimes(3);
    expect(logoutCallback).toHaveBeenCalledWith("sessionExpired");
  });

  it("retries with refreshed token for inactive user when 401 received", async () => {
    // getAccessToken returns the same token throughout - the token itself doesn't change,
    // but after the 401, tokenNeedsRefresh will return true, triggering a refresh
    tokenService.getAccessToken
      .calledWith(testInactiveUser)
      .mockResolvedValue("inactive_expired_token");
    // First call (initial request): token doesn't need refresh yet
    // Subsequent calls (after 401): token needs refresh, triggering the refresh flow
    tokenService.tokenNeedsRefresh
      .calledWith(testInactiveUser)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    tokenService.getRefreshToken
      .calledWith(testInactiveUser)
      .mockResolvedValue("inactive_refresh_token");

    tokenService.decodeAccessToken
      .calledWith(testInactiveUser)
      .mockResolvedValue({ client_id: "web" });

    tokenService.decodeAccessToken
      .calledWith("inactive_new_access_token")
      .mockResolvedValue({ sub: testInactiveUser });

    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$
      .calledWith(testInactiveUser)
      .mockReturnValue(of(VaultTimeoutAction.Lock));

    vaultTimeoutSettingsService.getVaultTimeoutByUserId$
      .calledWith(testInactiveUser)
      .mockReturnValue(of(VaultTimeoutStringType.Never));

    tokenService.setTokens
      .calledWith(
        "inactive_new_access_token",
        VaultTimeoutAction.Lock,
        VaultTimeoutStringType.Never,
        "inactive_new_refresh_token",
      )
      .mockResolvedValue({ accessToken: "inactive_refreshed_access_token" });

    environmentService.getEnvironment$.calledWith(testInactiveUser).mockReturnValue(
      of({
        getApiUrl: () => "https://inactive.example.com",
        getIdentityUrl: () => "https://identity.inactive.example.com",
      } satisfies Partial<Environment> as Environment),
    );

    httpOperations.createRequest.mockImplementation((url, request) => {
      return {
        url: url,
        cache: request.cache,
        credentials: request.credentials,
        method: request.method,
        mode: request.mode,
        signal: request.signal,
        headers: new Headers(request.headers),
      } satisfies Partial<Request> as unknown as Request;
    });

    const nativeFetch = jest.fn<Promise<Response>, [request: Request]>();
    let callCount = 0;

    nativeFetch.mockImplementation((request) => {
      callCount++;

      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: "Unauthorized" }),
          headers: new Headers({
            "content-type": "application/json",
          }),
        } satisfies Partial<Response> as Response);
      }

      if (callCount === 2 && request.url.includes("identity")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              access_token: "inactive_new_access_token",
              token_type: "Bearer",
              refresh_token: "inactive_new_refresh_token",
            }),
        } satisfies Partial<Response> as Response);
      }

      if (callCount === 3) {
        expect(request.headers.get("Authorization")).toBe("Bearer inactive_refreshed_access_token");
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: "inactive user success" }),
          headers: new Headers({
            "content-type": "application/json",
          }),
        } satisfies Partial<Response> as Response);
      }

      throw new Error("Unexpected call");
    });

    sut.nativeFetch = nativeFetch;

    const response = await sut.send("GET", "/something", null, testInactiveUser, true, null, null);

    expect(nativeFetch).toHaveBeenCalledTimes(3);
    expect(response).toEqual({ data: "inactive user success" });
  });
});
