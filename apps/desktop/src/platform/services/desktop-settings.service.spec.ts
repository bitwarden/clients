import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { StateProvider, GlobalState } from "@bitwarden/common/platform/state";

import * as utils from "../../utils";

import { DesktopSettingsService } from "./desktop-settings.service";

// Mock the utils module
jest.mock("../../utils", () => ({
  isWindowsStore: jest.fn(),
  isSnapStore: jest.fn(),
}));

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

    // Default: not Windows Store, not Snap
    (utils.isWindowsStore as jest.Mock).mockReturnValue(false);
    (utils.isSnapStore as jest.Mock).mockReturnValue(false);
  });

  describe("shouldDisplayAutoStartSetting", () => {
    it("should return true for standard platforms", () => {
      const result = service.shouldDisplayAutoStartSetting();

      expect(result).toBe(true);
    });

    it("should return false for Windows Store", () => {
      (utils.isWindowsStore as jest.Mock).mockReturnValue(true);

      const result = service.shouldDisplayAutoStartSetting();

      expect(result).toBe(false);
    });

    it("should return false for Snap", () => {
      (utils.isSnapStore as jest.Mock).mockReturnValue(true);

      const result = service.shouldDisplayAutoStartSetting();

      expect(result).toBe(false);
    });

    it("should return false when both Windows Store and Snap are true", () => {
      (utils.isWindowsStore as jest.Mock).mockReturnValue(true);
      (utils.isSnapStore as jest.Mock).mockReturnValue(true);

      const result = service.shouldDisplayAutoStartSetting();

      expect(result).toBe(false);
    });
  });
});
