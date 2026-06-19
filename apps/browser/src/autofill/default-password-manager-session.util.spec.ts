import { BrowserApi } from "../platform/browser/browser-api";

import {
  completePendingDefaultPasswordManagerApply,
  consumeDefaultPasswordManagerSuccessToast,
  setDefaultPasswordManagerSessionState,
} from "./default-password-manager-session.util";

jest.mock("../platform/browser/browser-api", () => ({
  BrowserApi: {
    updateDefaultBrowserAutofillSettings: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("default-password-manager-session.util", () => {
  const storage = new Map<string, unknown>();

  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();

    global.chrome = {
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
});
