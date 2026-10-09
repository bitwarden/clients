import { systemPreferences } from "electron";

import { managed_settings } from "@bitwarden/desktop-napi";

import { MacOsManagedSettingsSource } from "./macos-managed-settings.source";

jest.mock("electron", () => ({
  systemPreferences: {
    subscribeNotification: jest.fn(),
  },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  managed_settings: {
    read: jest.fn(),
    watch: jest.fn(),
  },
}));

const NOTIFICATION = "com.apple.MCX._managementStatusChangedForDomains";

describe("MacOsManagedSettingsSource", () => {
  let source: MacOsManagedSettingsSource;

  beforeEach(() => {
    source = new MacOsManagedSettingsSource();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("read", () => {
    it("returns the value the native read supplies", async () => {
      jest.mocked(managed_settings.read).mockResolvedValue('{"environment":{"base":"x"}}');

      await expect(source.read()).resolves.toBe('{"environment":{"base":"x"}}');
    });

    it("returns undefined when the native read returns null", async () => {
      jest.mocked(managed_settings.read).mockResolvedValue(null);

      await expect(source.read()).resolves.toBeUndefined();
    });
  });

  describe("watch", () => {
    function subscribedCallback(): (event: string, userInfo: Record<string, unknown>) => void {
      const subscribe = jest.mocked(systemPreferences.subscribeNotification);
      expect(subscribe).toHaveBeenCalledWith(NOTIFICATION, expect.any(Function));
      return subscribe.mock.calls[0][1] as (
        event: string,
        userInfo: Record<string, unknown>,
      ) => void;
    }

    it("signals a change when the changed domains include com.bitwarden.desktop", async () => {
      const onChanged = jest.fn();
      await source.watch(onChanged);

      subscribedCallback()(NOTIFICATION, {
        "com.apple.MCX.changedDomains": ["com.apple.Safari", "com.bitwarden.desktop"],
      });

      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("signals a change when the changed domains are not an array", async () => {
      const onChanged = jest.fn();
      await source.watch(onChanged);

      subscribedCallback()(NOTIFICATION, {});

      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("ignores a notification for other domains only", async () => {
      const onChanged = jest.fn();
      await source.watch(onChanged);

      subscribedCallback()(NOTIFICATION, {
        "com.apple.MCX.changedDomains": ["com.apple.Safari"],
      });

      expect(onChanged).not.toHaveBeenCalled();
    });
  });
});
