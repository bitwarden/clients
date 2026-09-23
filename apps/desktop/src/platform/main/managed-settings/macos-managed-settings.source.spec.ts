import { systemPreferences } from "electron";

import { MacOsManagedSettingsSource } from "./macos-managed-settings.source";
import { CONTAINER_VALUE } from "./managed-settings-source";

jest.mock("electron", () => ({
  systemPreferences: {
    getUserDefault: jest.fn(),
    subscribeNotification: jest.fn(),
  },
}));

describe("MacOsManagedSettingsSource", () => {
  let source: MacOsManagedSettingsSource;

  beforeEach(() => {
    source = new MacOsManagedSettingsSource();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("read", () => {
    it("returns the value supplied by getUserDefault", async () => {
      (systemPreferences.getUserDefault as jest.Mock).mockReturnValue('{"foo":"bar"}');

      const result = await source.read();

      expect(systemPreferences.getUserDefault).toHaveBeenCalledWith(CONTAINER_VALUE, "string");
      expect(result).toBe('{"foo":"bar"}');
    });

    it("returns undefined when getUserDefault returns an empty string", async () => {
      (systemPreferences.getUserDefault as jest.Mock).mockReturnValue("");

      const result = await source.read();

      expect(result).toBeUndefined();
    });

    it("returns undefined when getUserDefault returns undefined", async () => {
      (systemPreferences.getUserDefault as jest.Mock).mockReturnValue(undefined);

      const result = await source.read();

      expect(result).toBeUndefined();
    });
  });

  describe("watch", () => {
    it("subscribes to the management status changed notification", async () => {
      await source.watch(() => {});

      expect(systemPreferences.subscribeNotification).toHaveBeenCalledWith(
        "com.apple.MCX._managementStatusChangedForDomains",
        expect.any(Function),
      );
    });

    it("invokes onChanged when the subscription fires", async () => {
      const onChanged = jest.fn();
      (systemPreferences.subscribeNotification as jest.Mock).mockImplementation(
        (_name: string, callback: () => void) => {
          callback();
          return 0;
        },
      );

      await source.watch(onChanged);

      expect(onChanged).toHaveBeenCalled();
    });
  });
});
