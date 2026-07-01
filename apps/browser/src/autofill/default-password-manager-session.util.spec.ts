import { BrowserApi } from "../platform/browser/browser-api";

import {
  completePendingDefaultPasswordManagerApply,
  consumeDefaultPasswordManagerSuccessToast,
  getDefaultPasswordManagerSessionState,
  setDefaultPasswordManagerSessionState,
} from "./default-password-manager-session.util";

jest.mock("../platform/browser/browser-api", () => ({
  BrowserApi: {
    isWebExtensionsApi: false,
    updateDefaultBrowserAutofillSettings: jest.fn().mockResolvedValue(undefined),
  },
}));

function createChromeSessionStorageMock(
  storage: Map<string, unknown>,
): typeof chrome.storage.session {
  return {
    get: jest.fn((key: string, callback: (result: Record<string, unknown>) => void) => {
      callback({ [key]: storage.get(key) });
    }),
    set: jest.fn((value: Record<string, unknown>, callback: () => void) => {
      Object.entries(value).forEach(([key, entry]) => storage.set(key, entry));
      callback();
    }),
    remove: jest.fn((key: string, callback: () => void) => {
      storage.delete(key);
      callback();
    }),
  } as unknown as typeof chrome.storage.session;
}

function useWebExtSessionStorage(storage: Map<string, unknown>): void {
  BrowserApi.isWebExtensionsApi = true;
  global.browser = {
    storage: {
      session: {
        get: jest.fn((key: string) => Promise.resolve({ [key]: storage.get(key) })),
        set: jest.fn((value: Record<string, unknown>) => {
          Object.entries(value).forEach(([key, entry]) => storage.set(key, entry));
          return Promise.resolve();
        }),
        remove: jest.fn((key: string) => {
          storage.delete(key);
          return Promise.resolve();
        }),
      },
    },
  } as unknown as typeof browser;
}

describe("default-password-manager-session.util", () => {
  const storage = new Map<string, unknown>();

  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    BrowserApi.isWebExtensionsApi = false;
    global.chrome = {
      storage: { session: createChromeSessionStorageMock(storage) },
    } as unknown as typeof chrome;
  });

  it("should consume and clear the success toast flag", async () => {
    await setDefaultPasswordManagerSessionState("show-toast");

    await expect(consumeDefaultPasswordManagerSuccessToast()).resolves.toBe(true);
    await expect(consumeDefaultPasswordManagerSuccessToast()).resolves.toBe(false);
  });

  it("should complete a pending apply from the background", async () => {
    await setDefaultPasswordManagerSessionState("pending");

    await completePendingDefaultPasswordManagerApply();

    expect(BrowserApi.updateDefaultBrowserAutofillSettings).toHaveBeenCalledWith(false);
    await expect(consumeDefaultPasswordManagerSuccessToast()).resolves.toBe(true);
  });

  it("should return null when chrome session storage get resolves with undefined", async () => {
    (chrome.storage.session.get as jest.Mock).mockImplementation(
      (_key: string, callback: (result: Record<string, unknown> | undefined) => void) => {
        callback(undefined);
      },
    );

    await expect(getDefaultPasswordManagerSessionState()).resolves.toBeNull();
  });

  it("should return null when WebExtensions session storage get resolves with undefined", async () => {
    BrowserApi.isWebExtensionsApi = true;
    global.browser = {
      storage: {
        session: {
          get: jest.fn().mockResolvedValue(undefined),
        },
      },
    } as unknown as typeof browser;

    await expect(getDefaultPasswordManagerSessionState()).resolves.toBeNull();
  });

  it("should read and write session state via the WebExtensions API", async () => {
    const webExtStorage = new Map<string, unknown>();
    useWebExtSessionStorage(webExtStorage);

    await setDefaultPasswordManagerSessionState("pending");

    await completePendingDefaultPasswordManagerApply();

    expect(BrowserApi.updateDefaultBrowserAutofillSettings).toHaveBeenCalledWith(false);
    await expect(consumeDefaultPasswordManagerSuccessToast()).resolves.toBe(true);
  });
});
