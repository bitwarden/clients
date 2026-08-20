import { mock, MockProxy } from "jest-mock-extended";
import { Subject, firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { ImporterMetadata, ImportersMetadata, Instructions, Loader } from "../metadata";
import { ImportType } from "../models";

import { DefaultImportMetadataService } from "./default-import-metadata.service";

describe("ImportMetadataService", () => {
  let sut: DefaultImportMetadataService;
  let systemServiceProvider: MockProxy<SystemServiceProvider>;

  beforeEach(() => {
    const environment = mock<PlatformUtilsService>();
    environment.getClientType.mockReturnValue(ClientType.Desktop);

    systemServiceProvider = mock<SystemServiceProvider>({
      environment,
      log: jest.fn().mockReturnValue({ debug: jest.fn() }),
    });

    sut = new DefaultImportMetadataService(systemServiceProvider);
  });

  describe("metadata$", () => {
    let typeSubject: Subject<ImportType>;
    let mockLogger: { debug: jest.Mock };

    const environment = mock<PlatformUtilsService>();
    environment.getClientType.mockReturnValue(ClientType.Desktop);

    beforeEach(() => {
      typeSubject = new Subject<ImportType>();
      mockLogger = { debug: jest.fn() };

      systemServiceProvider = mock<SystemServiceProvider>({
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
  });
});
