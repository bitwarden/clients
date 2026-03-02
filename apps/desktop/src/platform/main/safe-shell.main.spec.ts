import { shell } from "electron";

import { SafeUrls } from "@bitwarden/common/platform/misc/safe-urls";
import { LogService } from "@bitwarden/logging";

import { SafeShell } from "./safe-shell.main";

jest.mock("electron", () => ({
  shell: {
    openExternal: jest.fn(),
  },
}));

jest.mock("@bitwarden/common/platform/misc/safe-urls");

describe("SafeShell", () => {
  let mockLogService: jest.Mocked<LogService>;

  beforeEach(() => {
    mockLogService = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    } as unknown as jest.Mocked<LogService>;

    jest.clearAllMocks();
  });

  describe("openExternal (static)", () => {
    it("opens the url when canLaunch returns true", () => {
      jest.mocked(SafeUrls.canLaunch).mockReturnValue(true);

      SafeShell.openExternal("https://bitwarden.com", mockLogService);

      expect(shell.openExternal).toHaveBeenCalledWith("https://bitwarden.com");
      expect(mockLogService.warning).not.toHaveBeenCalled();
    });

    it("blocks the url and logs a warning when canLaunch returns false", () => {
      jest.mocked(SafeUrls.canLaunch).mockReturnValue(false);

      SafeShell.openExternal("javascript:alert(1)", mockLogService);

      expect(shell.openExternal).not.toHaveBeenCalled();
      expect(mockLogService.warning).toHaveBeenCalledWith(
        "Blocked attempt to open unsafe external url: javascript:alert(1)",
      );
    });
  });

  describe("openExternal (instance)", () => {
    let safeShell: SafeShell;

    beforeEach(() => {
      safeShell = new SafeShell(mockLogService);
    });

    it("opens the url when canLaunch returns true", () => {
      jest.mocked(SafeUrls.canLaunch).mockReturnValue(true);

      safeShell.openExternal("https://bitwarden.com");

      expect(shell.openExternal).toHaveBeenCalledWith("https://bitwarden.com");
      expect(mockLogService.warning).not.toHaveBeenCalled();
    });

    it("blocks the url and logs a warning when canLaunch returns false", () => {
      jest.mocked(SafeUrls.canLaunch).mockReturnValue(false);

      safeShell.openExternal("javascript:alert(1)");

      expect(shell.openExternal).not.toHaveBeenCalled();
      expect(mockLogService.warning).toHaveBeenCalledWith(
        "Blocked attempt to open unsafe external url: javascript:alert(1)",
      );
    });
  });
});
