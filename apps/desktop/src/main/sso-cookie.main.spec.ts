import { BehaviorSubject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { GlobalState, GlobalStateProvider } from "@bitwarden/common/platform/state";
import { ServerCommunicationConfig } from "@bitwarden/sdk-internal";

import { SERVER_COMMUNICATION_CONFIGS } from "../platform/services/server-communication-config";

import { SsoCookieMain } from "./sso-cookie.main";

describe("SsoCookieMain", () => {
  let configsSubject: BehaviorSubject<Record<string, ServerCommunicationConfig> | null>;
  let mockGlobalStateProvider: jest.Mocked<GlobalStateProvider>;
  let mockLogService: jest.Mocked<Pick<LogService, "error">>;
  let mockCookiesSet: jest.Mock;
  let mockCookiesGet: jest.Mock;
  let mockCookiesRemove: jest.Mock;
  let mockSession: { cookies: { set: jest.Mock; get: jest.Mock; remove: jest.Mock } };
  let sut: SsoCookieMain;

  beforeEach(() => {
    configsSubject = new BehaviorSubject<Record<string, ServerCommunicationConfig> | null>(null);

    const mockGlobalState = {
      state$: configsSubject.asObservable(),
    } as unknown as GlobalState<Record<string, ServerCommunicationConfig>>;

    mockGlobalStateProvider = {
      get: jest.fn().mockReturnValue(mockGlobalState),
    } as unknown as jest.Mocked<GlobalStateProvider>;

    mockLogService = { error: jest.fn() };

    mockCookiesSet = jest.fn().mockResolvedValue(undefined);
    mockCookiesGet = jest.fn().mockResolvedValue([]);
    mockCookiesRemove = jest.fn().mockResolvedValue(undefined);

    mockSession = {
      cookies: {
        set: mockCookiesSet,
        get: mockCookiesGet,
        remove: mockCookiesRemove,
      },
    };

    sut = new SsoCookieMain(mockGlobalStateProvider, mockLogService as unknown as LogService);
  });

  function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  describe("init", () => {
    it("subscribes to SERVER_COMMUNICATION_CONFIGS state", () => {
      sut.init(mockSession as any);
      expect(mockGlobalStateProvider.get).toHaveBeenCalledWith(SERVER_COMMUNICATION_CONFIGS);
    });

    it("calls session.cookies.set for ssoCookieVendor config with cookieValue", async () => {
      sut.init(mockSession as any);

      configsSubject.next({
        "example.com": {
          bootstrap: {
            type: "ssoCookieVendor",
            cookieValue: [{ name: "auth", value: "tok" }],
            cookieName: undefined,
            cookieDomain: undefined,
            vaultUrl: undefined,
            idpLoginUrl: undefined,
          },
        },
      });

      await flushPromises();

      expect(mockCookiesSet).toHaveBeenCalledWith({
        url: "https://example.com",
        name: "auth",
        value: "tok",
        domain: "example.com",
        path: "/",
        sameSite: "no_restriction",
        secure: true,
      });
    });

    it("does NOT call session.cookies.set when cookieValue is undefined", async () => {
      sut.init(mockSession as any);

      configsSubject.next({
        "example.com": {
          bootstrap: {
            type: "ssoCookieVendor",
            cookieValue: undefined,
            cookieName: undefined,
            cookieDomain: undefined,
            vaultUrl: undefined,
            idpLoginUrl: undefined,
          },
        },
      });

      await flushPromises();

      expect(mockCookiesSet).not.toHaveBeenCalled();
    });

    it("does NOT call session.cookies.set when cookieValue is empty array", async () => {
      sut.init(mockSession as any);

      configsSubject.next({
        "example.com": {
          bootstrap: {
            type: "ssoCookieVendor",
            cookieValue: [],
            cookieName: undefined,
            cookieDomain: undefined,
            vaultUrl: undefined,
            idpLoginUrl: undefined,
          },
        },
      });

      await flushPromises();

      expect(mockCookiesSet).not.toHaveBeenCalled();
    });

    it("does NOT call session.cookies.set for type: 'direct' config", async () => {
      sut.init(mockSession as any);

      configsSubject.next({
        "example.com": {
          bootstrap: { type: "direct" },
        },
      });

      await flushPromises();

      expect(mockCookiesSet).not.toHaveBeenCalled();
    });

    it("does NOT call session.cookies.set when state is null", async () => {
      sut.init(mockSession as any);

      configsSubject.next(null);

      await flushPromises();

      expect(mockCookiesSet).not.toHaveBeenCalled();
    });

    it("clears previously set cookies and sets new ones on state update", async () => {
      sut.init(mockSession as any);

      // Initial state: set one cookie
      configsSubject.next({
        "example.com": {
          bootstrap: {
            type: "ssoCookieVendor",
            cookieValue: [{ name: "old-cookie", value: "old-value" }],
            cookieName: undefined,
            cookieDomain: undefined,
            vaultUrl: undefined,
            idpLoginUrl: undefined,
          },
        },
      });
      await flushPromises();

      expect(mockCookiesSet).toHaveBeenCalledTimes(1);

      // Mock get to return the old cookie for removal
      mockCookiesGet.mockResolvedValue([{ name: "old-cookie" }]);
      mockCookiesSet.mockClear();

      // Updated state: different cookie
      configsSubject.next({
        "example.com": {
          bootstrap: {
            type: "ssoCookieVendor",
            cookieValue: [{ name: "new-cookie", value: "new-value" }],
            cookieName: undefined,
            cookieDomain: undefined,
            vaultUrl: undefined,
            idpLoginUrl: undefined,
          },
        },
      });
      await flushPromises();

      expect(mockCookiesGet).toHaveBeenCalledWith({ domain: "example.com" });
      expect(mockCookiesRemove).toHaveBeenCalledWith("https://example.com", "old-cookie");
      expect(mockCookiesSet).toHaveBeenCalledWith({
        url: "https://example.com",
        name: "new-cookie",
        value: "new-value",
        domain: "example.com",
        path: "/",
        sameSite: "no_restriction",
        secure: true,
      });
    });

    it("logs error and continues when session.cookies.set throws", async () => {
      const error = new Error("set failed");
      mockCookiesSet.mockRejectedValue(error);

      sut.init(mockSession as any);

      configsSubject.next({
        "example.com": {
          bootstrap: {
            type: "ssoCookieVendor",
            cookieValue: [{ name: "auth", value: "tok" }],
            cookieName: undefined,
            cookieDomain: undefined,
            vaultUrl: undefined,
            idpLoginUrl: undefined,
          },
        },
      });

      await flushPromises();

      expect(mockLogService.error).toHaveBeenCalledWith(
        'SsoCookieMain: failed to set cookie "auth" for example.com',
        error,
      );
    });

    it("sets multiple sharded cookies for a single domain", async () => {
      sut.init(mockSession as any);

      configsSubject.next({
        "example.com": {
          bootstrap: {
            type: "ssoCookieVendor",
            cookieValue: [
              { name: "AWSELBAuthSessionCookie-0", value: "shard0" },
              { name: "AWSELBAuthSessionCookie-1", value: "shard1" },
            ],
            cookieName: undefined,
            cookieDomain: undefined,
            vaultUrl: undefined,
            idpLoginUrl: undefined,
          },
        },
      });

      await flushPromises();

      expect(mockCookiesSet).toHaveBeenCalledTimes(2);
      expect(mockCookiesSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "AWSELBAuthSessionCookie-0", value: "shard0" }),
      );
      expect(mockCookiesSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "AWSELBAuthSessionCookie-1", value: "shard1" }),
      );
    });
  });
});
