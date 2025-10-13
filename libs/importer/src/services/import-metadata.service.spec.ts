import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject, firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { ImporterMetadata, Instructions, Loader } from "../metadata";
import { ImportType } from "../models";

import { DefaultImportMetadataService } from "./default-import-metadata.service";
import { ImportMetadataServiceAbstraction } from "./import-metadata.service.abstraction";

describe("ImportMetadataService", () => {
  let sut: ImportMetadataServiceAbstraction;
  let systemServiceProvider: MockProxy<SystemServiceProvider>;

  beforeEach(() => {
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(new BehaviorSubject(false));

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
    let featureFlagSubject: BehaviorSubject<boolean>;
    let typeSubject: Subject<ImportType>;
    let mockLogger: { debug: jest.Mock };

    beforeEach(() => {
      featureFlagSubject = new BehaviorSubject(false);
      typeSubject = new Subject<ImportType>();
      mockLogger = { debug: jest.fn() };

      const configService = mock<ConfigService>();
      configService.getFeatureFlag$.mockReturnValue(featureFlagSubject);

      const environment = mock<PlatformUtilsService>();
      environment.getClientType.mockReturnValue(ClientType.Desktop);

      systemServiceProvider = mock<SystemServiceProvider>({
        configService,
        environment,
        log: jest.fn().mockReturnValue(mockLogger),
      });

      // Recreate the service with the updated mocks for logging tests
      sut = new DefaultImportMetadataService(systemServiceProvider);
    });

    afterEach(() => {
      featureFlagSubject.complete();
      typeSubject.complete();
    });

    it("should emit metadata when type$ emits", async () => {
      const testType: ImportType = "bitwardenjson";

      const metadataPromise = firstValueFrom(sut.metadata$(typeSubject));
      typeSubject.next(testType);

      const result = await metadataPromise;

      expect(result).toEqual({
        type: testType,
        loaders: expect.any(Array),
        instructions: Instructions.unique,
      });
      expect(result.type).toBe(testType);
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

    it("should include all loaders when chromium feature flag is enabled", async () => {
      const testType: ImportType = "bravecsv"; // bravecsv supports both file and chromium loaders
      featureFlagSubject.next(true);

      const metadataPromise = firstValueFrom(sut.metadata$(typeSubject));
      typeSubject.next(testType);

      const result = await metadataPromise;

      expect(result.loaders).toContain(Loader.chromium);
      expect(result.loaders).toContain(Loader.file);
    });

    it("should exclude chromium loader when feature flag is disabled", async () => {
      const testType: ImportType = "bravecsv"; // bravecsv supports both file and chromium loaders
      featureFlagSubject.next(false);

      const metadataPromise = firstValueFrom(sut.metadata$(typeSubject));
      typeSubject.next(testType);

      const result = await metadataPromise;

      expect(result.loaders).not.toContain(Loader.chromium);
      expect(result.loaders).toContain(Loader.file);
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

    it("should update when feature flag changes", async () => {
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
      expect(emissions[0].loaders).not.toContain(Loader.chromium);
      expect(emissions[1].loaders).toContain(Loader.chromium);

      subscription.unsubscribe();
    });

    it("should update when both type$ and feature flag change", async () => {
      const emissions: ImporterMetadata[] = [];

      const subscription = sut.metadata$(typeSubject).subscribe((metadata) => {
        emissions.push(metadata);
      });

      // Initial emission
      typeSubject.next("chromecsv");

      // Change both at the same time
      featureFlagSubject.next(true);
      typeSubject.next("bravecsv");

      // Wait for emissions
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(emissions.length).toBeGreaterThanOrEqual(2);
      const lastEmission = emissions[emissions.length - 1];
      expect(lastEmission.type).toBe("bravecsv");

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
  });
});
