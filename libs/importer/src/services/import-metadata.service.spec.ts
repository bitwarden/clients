import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject, firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { DeviceType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { ImporterMetadata, ImportersMetadata, Instructions, Loader } from "../metadata";
import { ImportType } from "../models";

import { DefaultImportMetadataService } from "./default-import-metadata.service";

describe("ImportMetadataService", () => {
  let sut: DefaultImportMetadataService;
  let systemServiceProvider: MockProxy<SystemServiceProvider>;

  beforeEach(() => {
    const configService = mock<ConfigService>();

    const environment = mock<PlatformUtilsService>();
    environment.getClientType.mockReturnValue(ClientType.Desktop);

    systemServiceProvider = mock<SystemServiceProvider>({
      configService,
      environment,
      log: jest.fn().mockReturnValue({ debug: jest.fn() }),
    });

    sut = new DefaultImportMetadataService(systemServiceProvider);
  });

  describe("metadata$", () => {
    let typeSubject: Subject<ImportType>;
    let mockLogger: { debug: jest.Mock };
    let featureFlagSubject: BehaviorSubject<boolean>;

    const environment = mock<PlatformUtilsService>();
    environment.getClientType.mockReturnValue(ClientType.Desktop);

    beforeEach(() => {
      typeSubject = new Subject<ImportType>();
      mockLogger = { debug: jest.fn() };
      featureFlagSubject = new BehaviorSubject<boolean>(false);

      const configService = mock<ConfigService>();
      configService.getFeatureFlag$.mockReturnValue(featureFlagSubject);

      systemServiceProvider = mock<SystemServiceProvider>({
        configService,
        environment,
        log: jest.fn().mockReturnValue(mockLogger),
      });

      // Recreate the service with the updated mocks for logging tests
      sut = new DefaultImportMetadataService(systemServiceProvider);

      // Set up importers to include bravecsv and chromecsv with chromium loader
      sut["importers"] = {
        chromecsv: {
          type: "chromecsv",
          loaders: [Loader.file, Loader.chromium],
          instructions: Instructions.chromium,
        },
        bravecsv: {
          type: "bravecsv",
          loaders: [Loader.file, Loader.chromium],
          instructions: Instructions.chromium,
        },
        edgecsv: {
          type: "edgecsv",
          loaders: [Loader.file, Loader.chromium],
          instructions: Instructions.chromium,
        },
      } as ImportersMetadata;
    });

    afterEach(() => {
      typeSubject.complete();
      featureFlagSubject.complete();
    });

    it("should emit metadata when type$ emits", async () => {
      const testType: ImportType = "chromecsv";

      const metadataPromise = firstValueFrom(sut.metadata$(typeSubject));
      typeSubject.next(testType);

      const result = await metadataPromise;

      expect(result).toEqual({
        type: testType,
        loaders: expect.any(Array),
        instructions: Instructions.chromium,
      });
      expect(result.type).toBe(testType);
    });

    it("should update when type$ changes", async () => {
      const emissions: ImporterMetadata[] = [];
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
      const testType: ImportType = "chromecsv";

      const metadataPromise = firstValueFrom(sut.metadata$(typeSubject));
      typeSubject.next(testType);

      await metadataPromise;

      expect(mockLogger.debug).toHaveBeenCalledWith(
        { importType: testType, capabilities: expect.any(Object) },
        "capabilities updated",
      );
    });

    it("should update when feature flag changes", async () => {
      environment.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
      const testType: ImportType = "bravecsv"; // Use bravecsv which supports chromium loader
      const emissions: ImporterMetadata[] = [];

      const subscription = sut.metadata$(typeSubject).subscribe((metadata) => {
        emissions.push(metadata);
      });

      typeSubject.next(testType);
      featureFlagSubject.next(true);

      // Wait for emissions
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(emissions).toHaveLength(2);
      // Disable ABE - chromium loader should be excluded
      expect(emissions[0].loaders).not.toContain(Loader.chromium);
      // Enabled ABE - chromium loader should be included
      expect(emissions[1].loaders).toContain(Loader.file);

      subscription.unsubscribe();
    });

    it("should exclude chromium loader when ABE is disabled and on Windows Desktop", async () => {
      environment.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
      const testType: ImportType = "bravecsv"; // bravecsv supports both file and chromium loaders
      featureFlagSubject.next(false);

      const metadataPromise = firstValueFrom(sut.metadata$(typeSubject));
      typeSubject.next(testType);

      const result = await metadataPromise;

      expect(result.loaders).not.toContain(Loader.chromium);
      expect(result.loaders).toContain(Loader.file);
    });

    it("should exclude chromium loader when ABE is disabled and getDevice throws error", async () => {
      environment.getDevice.mockImplementation(() => {
        throw new Error("Device detection failed");
      });
      const testType: ImportType = "bravecsv";
      featureFlagSubject.next(false);

      const metadataPromise = firstValueFrom(sut.metadata$(typeSubject));
      typeSubject.next(testType);

      const result = await metadataPromise;

      expect(result.loaders).not.toContain(Loader.chromium);
      expect(result.loaders).toContain(Loader.file);
    });

    it("should include chromium loader when ABE is disabled and not on Windows Desktop", async () => {
      environment.getDevice.mockReturnValue(DeviceType.MacOsDesktop);
      const testType: ImportType = "bravecsv"; // bravecsv supports both file and chromium loaders
      featureFlagSubject.next(false);

      const metadataPromise = firstValueFrom(sut.metadata$(typeSubject));
      typeSubject.next(testType);

      const result = await metadataPromise;

      expect(result.loaders).toContain(Loader.chromium);
      expect(result.loaders).toContain(Loader.file);
    });

    it("should include chromium loader when ABE is enabled regardless of device", async () => {
      environment.getDevice.mockReturnValue(DeviceType.MacOsDesktop);
      const testType: ImportType = "bravecsv"; // bravecsv supports both file and chromium loaders
      featureFlagSubject.next(true);

      const metadataPromise = firstValueFrom(sut.metadata$(typeSubject));
      typeSubject.next(testType);

      const result = await metadataPromise;

      expect(result.loaders).toContain(Loader.chromium);
    });
  });
});
