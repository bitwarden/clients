import { managed_settings } from "@bitwarden/desktop-napi";

import { WindowsManagedSettingsSource } from "./windows-managed-settings.source";

jest.mock("@bitwarden/desktop-napi", () => ({
  managed_settings: {
    read: jest.fn(),
    watch: jest.fn(),
  },
}));

describe("WindowsManagedSettingsSource", () => {
  let source: WindowsManagedSettingsSource;

  beforeEach(() => {
    source = new WindowsManagedSettingsSource();
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
    it("passes the native watch callback through to onChanged", async () => {
      jest.mocked(managed_settings.watch).mockResolvedValue(undefined);
      const onChanged = jest.fn();

      await source.watch(onChanged);
      const nativeCallback = jest.mocked(managed_settings.watch).mock.calls[0][0];
      nativeCallback(null);

      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("rejects when the native watch fails to start", async () => {
      jest.mocked(managed_settings.watch).mockRejectedValue(new Error("no ancestor"));

      await expect(source.watch(jest.fn())).rejects.toThrow("no ancestor");
    });
  });
});
