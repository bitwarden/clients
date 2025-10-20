import { mock, MockProxy } from "jest-mock-extended";
import { Subject, firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { ImporterMetadata, Instructions } from "../metadata";
import { ImportType } from "../models";

import { DefaultImportMetadataService } from "./default-import-metadata.service";
import { ImportMetadataServiceAbstraction } from "./import-metadata.service.abstraction";

describe("ImportMetadataService", () => {
  let sut: ImportMetadataServiceAbstraction;
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

    beforeEach(() => {
      typeSubject = new Subject<ImportType>();
      mockLogger = { debug: jest.fn() };

      const configService = mock<ConfigService>();

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
