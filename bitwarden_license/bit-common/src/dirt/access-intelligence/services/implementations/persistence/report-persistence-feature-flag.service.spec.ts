import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import { AccessReportView } from "../../../models";

import { DefaultReportPersistenceService } from "./default-report-persistence.service";
import { FileReportPersistenceService } from "./file-report-persistence.service";
import { ReportPersistenceFeatureFlagService } from "./report-persistence-feature-flag.service";

describe("ReportPersistenceFeatureFlagService", () => {
  let service: ReportPersistenceFeatureFlagService;
  let fileService: MockProxy<FileReportPersistenceService>;
  let defaultService: MockProxy<DefaultReportPersistenceService>;
  let configService: MockProxy<ConfigService>;

  const orgId = "org-123" as OrganizationId;
  const reportId = "report-456" as OrganizationReportId;
  const view = mock<AccessReportView>();

  beforeEach(() => {
    fileService = mock<FileReportPersistenceService>();
    defaultService = mock<DefaultReportPersistenceService>();
    configService = mock<ConfigService>();

    service = new ReportPersistenceFeatureFlagService(fileService, defaultService, configService);
  });

  describe("loadLastReport$", () => {
    it("always delegates to fileService", async () => {
      const expected = { report: view, hadLegacyBlobs: false };
      fileService.loadLastReport$.mockReturnValue(of(expected));

      const result = await firstValueFrom(service.loadLastReport$(orgId));

      expect(fileService.loadLastReport$).toHaveBeenCalledWith(orgId);
      expect(defaultService.loadLastReport$).not.toHaveBeenCalled();
      expect(result).toBe(expected);
    });

    it("does not read the file-storage flag for loads", async () => {
      fileService.loadLastReport$.mockReturnValue(of(null));

      await firstValueFrom(service.loadLastReport$(orgId));

      expect(configService.getFeatureFlag$).not.toHaveBeenCalled();
    });
  });

  describe("saveApplicationMetadata$", () => {
    it("delegates to fileService when flag is enabled", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      fileService.saveApplicationMetadata$.mockReturnValue(of(undefined));

      await firstValueFrom(service.saveApplicationMetadata$(view));

      expect(fileService.saveApplicationMetadata$).toHaveBeenCalledWith(view);
      expect(defaultService.saveApplicationMetadata$).not.toHaveBeenCalled();
    });

    it("delegates to defaultService when flag is disabled", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));
      defaultService.saveApplicationMetadata$.mockReturnValue(of(undefined));

      await firstValueFrom(service.saveApplicationMetadata$(view));

      expect(defaultService.saveApplicationMetadata$).toHaveBeenCalledWith(view);
      expect(fileService.saveApplicationMetadata$).not.toHaveBeenCalled();
    });
  });

  describe("saveReport$", () => {
    it("delegates to fileService when flag is enabled", async () => {
      const encString = {} as any;
      const expected = { id: reportId, contentEncryptionKey: encString };
      configService.getFeatureFlag$.mockReturnValue(of(true));
      fileService.saveReport$.mockReturnValue(of(expected));

      const result = await firstValueFrom(service.saveReport$(view, orgId));

      expect(fileService.saveReport$).toHaveBeenCalledWith(view, orgId);
      expect(defaultService.saveReport$).not.toHaveBeenCalled();
      expect(result).toBe(expected);
    });

    it("delegates to defaultService when flag is disabled", async () => {
      const encString = {} as any;
      const expected = { id: reportId, contentEncryptionKey: encString };
      configService.getFeatureFlag$.mockReturnValue(of(false));
      defaultService.saveReport$.mockReturnValue(of(expected));

      const result = await firstValueFrom(service.saveReport$(view, orgId));

      expect(defaultService.saveReport$).toHaveBeenCalledWith(view, orgId);
      expect(fileService.saveReport$).not.toHaveBeenCalled();
      expect(result).toBe(expected);
    });
  });
});
