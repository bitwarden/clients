import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { DesktopImportMetadataService } from "./desktop-import-metadata.service";

describe("DesktopImportMetadataService", () => {
  let sut: DesktopImportMetadataService;
  let systemServiceProvider: MockProxy<SystemServiceProvider>;
  let i18nService: MockProxy<I18nService>;
  let requestBrowserAccess: jest.Mock;
  let getAvailableProfiles: jest.Mock;
  let originalIpc: unknown;

  beforeEach(() => {
    systemServiceProvider = mock<SystemServiceProvider>();
    i18nService = mock<I18nService>({
      t: (key: string, ...args: string[]) => [key, ...args].join(":"),
    });
    sut = new DesktopImportMetadataService(systemServiceProvider, i18nService);

    requestBrowserAccess = jest.fn().mockResolvedValue(undefined);
    getAvailableProfiles = jest.fn().mockResolvedValue([{ id: "Default", name: "Default" }]);
    originalIpc = (global as any).ipc;
    (global as any).ipc = {
      tools: {
        chromiumImporter: {
          requestBrowserAccess,
          getAvailableProfiles,
        },
      },
    };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
  });

  describe("getAvailableProfiles", () => {
    it("resolves the real per-browser display name before calling the native module", async () => {
      await sut.getAvailableProfiles("bravecsv");

      expect(requestBrowserAccess).toHaveBeenCalledWith("Brave", expect.any(Object));
      expect(getAvailableProfiles).toHaveBeenCalledWith("Brave");
    });

    it("defaults to Chrome for chromecsv", async () => {
      await sut.getAvailableProfiles("chromecsv");

      expect(requestBrowserAccess).toHaveBeenCalledWith("Chrome", expect.any(Object));
      expect(getAvailableProfiles).toHaveBeenCalledWith("Chrome");
    });

    it("returns the native module's profile list on success", async () => {
      await expect(sut.getAvailableProfiles("chromecsv")).resolves.toEqual([
        { id: "Default", name: "Default" },
      ]);
    });

    it("maps a browser-not-installed error to the translated, browser-specific message", async () => {
      requestBrowserAccess.mockRejectedValue(
        new Error("some native chain: chromiumImporterBrowserNotInstalled:Brave: more detail"),
      );

      await expect(sut.getAvailableProfiles("bravecsv")).rejects.toThrow(
        "chromiumImporterBrowserNotInstalled:Brave",
      );
    });

    it("maps any other requestBrowserAccess failure to a generic access-denied message", async () => {
      requestBrowserAccess.mockRejectedValue(new Error("permission denied"));

      await expect(sut.getAvailableProfiles("chromecsv")).rejects.toThrow("browserAccessDenied");
    });

    it("maps a getAvailableProfiles failure to a generic error message", async () => {
      getAvailableProfiles.mockRejectedValue(new Error("native crash"));

      await expect(sut.getAvailableProfiles("chromecsv")).rejects.toThrow("errorOccurred");
    });
  });
});
