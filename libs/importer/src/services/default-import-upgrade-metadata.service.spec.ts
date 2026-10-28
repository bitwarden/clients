import { mock, MockProxy } from "jest-mock-extended";
import { Subject, firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { Loader } from "../metadata";
import { ImportOption, UpgradeImportType } from "../models";

import { DefaultImportUpgradeMetadataService } from "./default-import-upgrade-metadata.service";
import { ImporterUpgradeCapabilities } from "./import-upgrade-metadata.service.abstraction";

function mockImportOption(id: UpgradeImportType, loaders: ImportOption["loaders"]): ImportOption {
  return {
    id,
    name: id,
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders,
  };
}

describe("DefaultImportUpgradeMetadataService", () => {
  let sut: DefaultImportUpgradeMetadataService;
  let systemServiceProvider: MockProxy<SystemServiceProvider>;

  beforeEach(() => {
    const environment = mock<PlatformUtilsService>();
    environment.getClientType.mockReturnValue(ClientType.Desktop);

    systemServiceProvider = mock<SystemServiceProvider>({
      environment,
      log: jest.fn().mockReturnValue({ debug: jest.fn() }),
    });

    sut = new DefaultImportUpgradeMetadataService(systemServiceProvider);
  });

  describe("metadata$", () => {
    let typeSubject: Subject<UpgradeImportType>;
    let mockLogger: { debug: jest.Mock };

    const environment = mock<PlatformUtilsService>();
    environment.getClientType.mockReturnValue(ClientType.Desktop);

    beforeEach(() => {
      typeSubject = new Subject<UpgradeImportType>();
      mockLogger = { debug: jest.fn() };

      systemServiceProvider = mock<SystemServiceProvider>({
        environment,
        log: jest.fn().mockReturnValue(mockLogger),
      });

      // Recreate the service with the updated mocks for logging tests
      sut = new DefaultImportUpgradeMetadataService(systemServiceProvider);

      // Set up importers to include bravecsv and chromecsv with chromium loader
      sut["importers"] = {
        chromecsv: mockImportOption("chromecsv", [Loader.file, Loader.chromium]),
        bravecsv: mockImportOption("bravecsv", [Loader.file, Loader.chromium]),
        edgecsv: mockImportOption("edgecsv", [Loader.file, Loader.chromium]),
      } as Record<UpgradeImportType, ImportOption>;
    });

    afterEach(() => {
      typeSubject.complete();
    });

    it("should emit metadata when type$ emits", async () => {
      const testType: UpgradeImportType = "chromecsv";

      const metadataPromise = firstValueFrom(sut.metadata$(typeSubject));
      typeSubject.next(testType);

      const result = await metadataPromise;

      expect(result).toEqual({
        type: testType,
        loaders: expect.any(Array),
      });
      expect(result.type).toBe(testType);
    });

    it("should update when type$ changes", async () => {
      const emissions: ImporterUpgradeCapabilities[] = [];
      const subscription = sut.metadata$(typeSubject).subscribe((metadata) => {
        emissions.push(metadata);
      });

      typeSubject.next("chromecsv");
      typeSubject.next("bravecsv");

      // Wait for emissions
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(emissions).toHaveLength(2);
      expect(emissions[0].type).toBe("chromecsv");
      expect(emissions[1].type).toBe("bravecsv");

      subscription.unsubscribe();
    });

    it("should log debug information with correct data", async () => {
      const testType: UpgradeImportType = "chromecsv";

      const metadataPromise = firstValueFrom(sut.metadata$(typeSubject));
      typeSubject.next(testType);

      await metadataPromise;

      expect(mockLogger.debug).toHaveBeenCalledWith(
        { importType: testType, capabilities: expect.any(Object) },
        "capabilities updated",
      );
    });
  });

  describe("getAvailableProfiles", () => {
    it("returns no profiles — chromium mode isn't reachable on non-Desktop clients", async () => {
      await expect(sut.getAvailableProfiles("bravecsv")).resolves.toEqual([]);
    });
  });

  describe("getChromiumLogins", () => {
    it("returns no logins — chromium mode isn't reachable on non-Desktop clients", async () => {
      await expect(sut.getChromiumLogins("bravecsv", "Default")).resolves.toEqual([]);
    });
  });
});
