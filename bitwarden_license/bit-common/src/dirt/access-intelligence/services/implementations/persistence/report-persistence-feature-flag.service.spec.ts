import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
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

  describe("loadReport$", () => {
    it("delegates to fileService when flag is enabled", async () => {
      const expected = { report: view, hadLegacyBlobs: false };
      configService.getFeatureFlag$.mockReturnValue(of(true));
      fileService.loadReport$.mockReturnValue(of(expected));

      const result = await firstValueFrom(service.loadReport$(orgId));

      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.AccessIntelligenceReportFileStorage,
      );
      expect(fileService.loadReport$).toHaveBeenCalledWith(orgId);
      expect(defaultService.loadReport$).not.toHaveBeenCalled();
      expect(result).toBe(expected);
    });

    it("delegates to defaultService when flag is disabled", async () => {
      const expected = { report: view, hadLegacyBlobs: false };
      configService.getFeatureFlag$.mockReturnValue(of(false));
      defaultService.loadReport$.mockReturnValue(of(expected));

      const result = await firstValueFrom(service.loadReport$(orgId));

      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.AccessIntelligenceReportFileStorage,
      );
      expect(defaultService.loadReport$).toHaveBeenCalledWith(orgId);
      expect(fileService.loadReport$).not.toHaveBeenCalled();
      expect(result).toBe(expected);
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
