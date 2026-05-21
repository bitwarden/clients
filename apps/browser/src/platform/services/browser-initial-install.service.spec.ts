import { mock } from "jest-mock-extended";

import { StateProvider } from "@bitwarden/common/platform/state";

import BrowserInitialInstallService from "./browser-initial-install.service";

describe("BrowserInitialInstallService", () => {
  let service: BrowserInitialInstallService;
  let managedGetMock: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    const stateProvider = mock<StateProvider>();
    stateProvider.getGlobal.mockReturnValue({
      state$: { pipe: () => ({}) } as any,
      update: jest.fn(),
    } as any);

    service = new BrowserInitialInstallService(stateProvider);

    managedGetMock = jest.fn();
    (chrome.storage as any).managed = { get: managedGetMock };
  });

  afterEach(() => {
    delete (chrome.storage as any).managed;
    (chrome.runtime.lastError as any) = undefined;
  });

  describe("isWelcomeScreenDisabledByPolicy", () => {
    it("returns true when the policy is set to true", async () => {
      managedGetMock.mockImplementation((_key, callback) => {
        callback({ skipWelcomeOnInstall: true });
      });

      await expect(service.isWelcomeScreenDisabledByPolicy()).resolves.toBe(true);
    });

    it("returns false when the policy is set to false", async () => {
      managedGetMock.mockImplementation((_key, callback) => {
        callback({ skipWelcomeOnInstall: false });
      });

      await expect(service.isWelcomeScreenDisabledByPolicy()).resolves.toBe(false);
    });

    it("returns false when the policy key is absent from the result", async () => {
      managedGetMock.mockImplementation((_key, callback) => {
        callback({});
      });

      await expect(service.isWelcomeScreenDisabledByPolicy()).resolves.toBe(false);
    });

    it("returns false when the result is null", async () => {
      managedGetMock.mockImplementation((_key, callback) => {
        callback(null);
      });

      await expect(service.isWelcomeScreenDisabledByPolicy()).resolves.toBe(false);
    });

    it("returns false when chrome.runtime.lastError is set", async () => {
      managedGetMock.mockImplementation((_key, callback) => {
        (chrome.runtime.lastError as any) = new Error("managed storage unavailable");
        callback({});
      });

      await expect(service.isWelcomeScreenDisabledByPolicy()).resolves.toBe(false);
    });

    it("returns false when chrome.storage.managed.get throws", async () => {
      managedGetMock.mockImplementation(() => {
        throw new Error("boom");
      });

      await expect(service.isWelcomeScreenDisabledByPolicy()).resolves.toBe(false);
    });

    it("returns false when chrome.storage.managed is unavailable", async () => {
      delete (chrome.storage as any).managed;

      await expect(service.isWelcomeScreenDisabledByPolicy()).resolves.toBe(false);
    });
  });
});
