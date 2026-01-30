import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { StateProvider, GlobalState } from "@bitwarden/common/platform/state";

import { DesktopSettingsService } from "./desktop-settings.service";

// Mock the global ipc object
(global as any).ipc = {
  platform: {
    isWindowsStore: false,
    isSnapStore: false,
  },
};

describe("DesktopSettingsService", () => {
  let service: DesktopSettingsService;
  let stateProvider: MockProxy<StateProvider>;

  beforeEach(() => {
    stateProvider = mock<StateProvider>();

    // Mock getGlobal to return a mock state with state$ observable
    const mockState = {
      state$: of(null),
      update: jest.fn(),
    } as unknown as GlobalState<any>;

    stateProvider.getGlobal.mockReturnValue(mockState);
    stateProvider.getActive.mockReturnValue(mockState as any);
    stateProvider.getUser.mockReturnValue(mockState as any);

    service = new DesktopSettingsService(stateProvider);
    jest.clearAllMocks();

    // Reset ipc platform values to defaults
    (global as any).ipc.platform.isWindowsStore = false;
    (global as any).ipc.platform.isSnapStore = false;
  });

  describe("shouldDisplayAutoStartSetting", () => {
    it("should return true for standard platforms", () => {
      const result = service.shouldDisplayAutoStartSetting();

      expect(result).toBe(true);
    });

    it("should return false for Windows Store", () => {
      (global as any).ipc.platform.isWindowsStore = true;

      const result = service.shouldDisplayAutoStartSetting();

      expect(result).toBe(false);
    });

    it("should return false for Snap", () => {
      (global as any).ipc.platform.isSnapStore = true;

      const result = service.shouldDisplayAutoStartSetting();

      expect(result).toBe(false);
    });

    it("should return false when both Windows Store and Snap are true", () => {
      (global as any).ipc.platform.isWindowsStore = true;
      (global as any).ipc.platform.isSnapStore = true;

      const result = service.shouldDisplayAutoStartSetting();

      expect(result).toBe(false);
    });
  });
});
