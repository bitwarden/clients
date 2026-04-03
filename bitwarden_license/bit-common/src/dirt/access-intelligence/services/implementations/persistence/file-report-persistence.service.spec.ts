import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of, throwError } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import {
  FileUploadApiMethods,
  FileUploadService,
} from "@bitwarden/common/platform/abstractions/file-upload/file-upload.service";
import { FileUploadType } from "@bitwarden/common/platform/enums";
import { makeEncString } from "@bitwarden/common/spec";
import { OrganizationId, OrganizationReportId, UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import {
  AccessReport,
  AccessReportApi,
  AccessReportFileApi,
  AccessReportView,
} from "../../../../access-intelligence/models";
import {
  createAccessReportMetrics,
  createRiskInsights,
  createRiskInsightsSummary,
} from "../../../../reports/risk-insights/testing/test-helpers";
import { AccessIntelligenceApiService } from "../../abstractions/access-intelligence-api.service";
import { AccessReportEncryptionService } from "../../abstractions/access-report-encryption.service";

import { FileReportPersistenceService } from "./file-report-persistence.service";

describe("FileReportPersistenceService", () => {
  let service: FileReportPersistenceService;
  let mockApiService: MockProxy<AccessIntelligenceApiService>;
  let mockEncryptionService: MockProxy<AccessReportEncryptionService>;
  let mockAccountService: MockProxy<AccountService>;
  let mockLogService: MockProxy<LogService>;
  let mockFileUploadService: MockProxy<FileUploadService>;

  const organizationId = "org-123" as OrganizationId;
  const reportId = "report-456" as OrganizationReportId;
  const reportFileId = "file-789";
  const userId = "user-789" as UserId;

  function makeCreateResponse(
    uploadUrl = "https://storage.example.com/upload",
    fileUploadType = FileUploadType.Azure,
  ): AccessReportFileApi {
    return new AccessReportFileApi({
      ReportFileUploadUrl: uploadUrl,
      FileUploadType: fileUploadType,
      ReportResponse: {
        Id: reportId,
        OrganizationId: organizationId,
        CreationDate: "2024-01-01T00:00:00Z",
        ContentEncryptionKey: "enc-key",
        ReportFile: { Id: reportFileId },
      },
    });
  }

  function makeMockDomain(): AccessReport {
    const domain = new AccessReport();
    domain.reports = makeEncString("encrypted-reports");
    domain.summary = makeEncString("encrypted-summary");
    domain.applications = makeEncString("encrypted-apps");
    domain.contentEncryptionKey = makeEncString("encryption-key");
    domain.creationDate = new Date();
    return domain;
  }

  beforeAll(() => {
    // jsdom does not implement File.prototype.arrayBuffer — polyfill for tests
    if (!File.prototype.arrayBuffer) {
      Object.defineProperty(File.prototype, "arrayBuffer", {
        value: function () {
          return Promise.resolve(new ArrayBuffer(0));
        },
        writable: true,
      });
    }
  });

  beforeEach(() => {
    mockApiService = mock<AccessIntelligenceApiService>();
    mockEncryptionService = mock<AccessReportEncryptionService>();
    mockAccountService = mock<AccountService>();
    mockLogService = mock<LogService>();
    mockFileUploadService = mock<FileUploadService>();

    mockAccountService.activeAccount$ = of({ id: userId } as Account);

    service = new FileReportPersistenceService(
      mockApiService,
      mockEncryptionService,
      mockAccountService,
      mockLogService,
      mockFileUploadService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("saveReport$", () => {
    it("should encrypt view, create report, upload file, and return report ID and key", async () => {
      const view = createRiskInsights({ organizationId });
      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(makeMockDomain()));
      mockApiService.createReport$.mockReturnValue(of(makeCreateResponse()));
      mockFileUploadService.upload.mockResolvedValue(undefined);

      const result = await firstValueFrom(service.saveReport$(view, organizationId));

      expect(result.id).toBe(reportId);
      expect(result.contentEncryptionKey).toBeDefined();
      expect(AccessReport.fromView).toHaveBeenCalledWith(view, mockEncryptionService, {
        organizationId,
        userId,
      });
      expect(mockApiService.createReport$).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          contentEncryptionKey: expect.any(String),
          fileSize: expect.any(Number),
        }),
      );
    });

    it("should pass upload URL and type from createReport$ response to fileUploadService", async () => {
      const view = createRiskInsights({ organizationId });
      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(makeMockDomain()));
      mockApiService.createReport$.mockReturnValue(
        of(makeCreateResponse("https://azure.blob/upload", FileUploadType.Azure)),
      );
      mockFileUploadService.upload.mockResolvedValue(undefined);

      await firstValueFrom(service.saveReport$(view, organizationId));

      expect(mockFileUploadService.upload).toHaveBeenCalledWith(
        { url: "https://azure.blob/upload", fileUploadType: FileUploadType.Azure },
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          postDirect: expect.any(Function),
          renewFileUploadUrl: expect.any(Function),
          rollback: expect.any(Function),
        }),
      );
    });

    it("should throw if contentEncryptionKey is absent from domain", async () => {
      const view = createRiskInsights({ organizationId });
      const domainNoKey = new AccessReport();
      domainNoKey.contentEncryptionKey = undefined;
      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(domainNoKey));

      await expect(firstValueFrom(service.saveReport$(view, organizationId))).rejects.toThrow(
        "Report encryption key not found",
      );
    });

    it("should throw if user ID is not found", async () => {
      mockAccountService.activeAccount$ = of(null as any);
      const view = createRiskInsights({ organizationId });

      await expect(firstValueFrom(service.saveReport$(view, organizationId))).rejects.toThrow(
        "Null or undefined account",
      );
    });

    it("should propagate createReport$ errors", async () => {
      const view = createRiskInsights({ organizationId });
      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(makeMockDomain()));
      mockApiService.createReport$.mockReturnValue(throwError(() => new Error("API error")));

      await expect(firstValueFrom(service.saveReport$(view, organizationId))).rejects.toThrow(
        "API error",
      );
    });

    it("should propagate file upload errors", async () => {
      const view = createRiskInsights({ organizationId });
      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(makeMockDomain()));
      mockApiService.createReport$.mockReturnValue(of(makeCreateResponse()));
      mockFileUploadService.upload.mockRejectedValue(new Error("Upload failed"));

      await expect(firstValueFrom(service.saveReport$(view, organizationId))).rejects.toThrow(
        "Upload failed",
      );
    });

    describe("file upload callbacks", () => {
      let capturedMethods: FileUploadApiMethods;

      beforeEach(async () => {
        const view = createRiskInsights({ organizationId });
        jest.spyOn(AccessReport, "fromView").mockReturnValue(of(makeMockDomain()));
        mockApiService.createReport$.mockReturnValue(of(makeCreateResponse()));
        mockFileUploadService.upload.mockImplementation(async (_data, _name, _file, methods) => {
          capturedMethods = methods;
        });

        await firstValueFrom(service.saveReport$(view, organizationId));
      });

      it("postDirect callback should call uploadReportFile$ with correct args", async () => {
        mockApiService.uploadReportFile$.mockReturnValue(of(undefined));

        await capturedMethods.postDirect(new FormData());

        expect(mockApiService.uploadReportFile$).toHaveBeenCalledWith(
          organizationId,
          reportId,
          expect.any(File),
          reportFileId,
        );
      });

      it("renewFileUploadUrl callback should call renewReportFileUpload$ and return the new URL", async () => {
        const newUrl = "https://storage.example.com/renewed";
        const renewResponse = new AccessReportFileApi({
          ReportFileUploadUrl: newUrl,
          FileUploadType: FileUploadType.Azure,
          ReportResponse: { Id: reportId, OrganizationId: organizationId },
        });
        mockApiService.renewReportFileUpload$.mockReturnValue(of(renewResponse));

        const url = await capturedMethods.renewFileUploadUrl();

        expect(url).toBe(newUrl);
        expect(mockApiService.renewReportFileUpload$).toHaveBeenCalledWith(
          organizationId,
          reportId,
        );
      });

      it("rollback callback should call deleteReport$", async () => {
        mockApiService.deleteReport$.mockReturnValue(of(undefined));

        await capturedMethods.rollback();

        expect(mockApiService.deleteReport$).toHaveBeenCalledWith(organizationId, reportId);
      });
    });
  });

  describe("saveApplicationMetadata$", () => {
    it("should call updateApplicationData$ and updateSummaryData$ with encrypted data", async () => {
      const summary = createRiskInsightsSummary({
        totalApplicationCount: 5,
        totalAtRiskApplicationCount: 2,
        totalMemberCount: 10,
        totalAtRiskMemberCount: 3,
      });
      const view = createRiskInsights({ id: reportId, organizationId, summary });

      const mockMetrics = createAccessReportMetrics({
        totalApplicationCount: 5,
        totalAtRiskApplicationCount: 2,
        totalMemberCount: 10,
        totalAtRiskMemberCount: 3,
      });
      jest.spyOn(view, "toMetrics").mockReturnValue(mockMetrics);
      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(makeMockDomain()));

      mockApiService.updateApplicationData$.mockReturnValue(of({} as AccessReportApi));
      mockApiService.updateSummaryData$.mockReturnValue(of({} as AccessReportApi));

      await firstValueFrom(service.saveApplicationMetadata$(view));

      expect(mockApiService.updateApplicationData$).toHaveBeenCalledWith(
        organizationId,
        reportId,
        expect.any(String),
      );
      expect(mockApiService.updateSummaryData$).toHaveBeenCalledWith(
        organizationId,
        reportId,
        expect.any(String),
        expect.any(Object),
      );
    });

    it("should throw if user ID is not found", async () => {
      mockAccountService.activeAccount$ = of(null as any);
      const view = createRiskInsights({ id: reportId, organizationId });

      await expect(firstValueFrom(service.saveApplicationMetadata$(view))).rejects.toThrow(
        "Null or undefined account",
      );
    });

    it("should propagate encryption errors", async () => {
      const view = createRiskInsights({ id: reportId, organizationId });
      jest
        .spyOn(AccessReport, "fromView")
        .mockReturnValue(throwError(() => new Error("Encryption failed")));

      await expect(firstValueFrom(service.saveApplicationMetadata$(view))).rejects.toThrow(
        "Encryption failed",
      );
    });

    it("should propagate API update errors", async () => {
      const view = createRiskInsights({ id: reportId, organizationId });
      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(makeMockDomain()));
      jest.spyOn(view, "toMetrics").mockReturnValue(createAccessReportMetrics({}));

      mockApiService.updateApplicationData$.mockReturnValue(
        throwError(() => new Error("Update failed")),
      );

      await expect(firstValueFrom(service.saveApplicationMetadata$(view))).rejects.toThrow(
        "Update failed",
      );
    });
  });

  describe("loadReport$", () => {
    function makeApiResponse(overrides: Partial<AccessReportApi> = {}): AccessReportApi {
      const response = new AccessReportApi();
      response.id = reportId;
      response.organizationId = organizationId;
      response.contentEncryptionKey = "enc-key";
      response.summaryData = "encrypted-summary";
      response.applicationData = "encrypted-apps";
      response.creationDate = "2024-01-01T00:00:00Z";
      Object.assign(response, overrides);
      return response;
    }

    function mockDecrypt(view?: AccessReportView) {
      const decryptedView = view ?? createRiskInsights({ id: reportId, organizationId });
      jest
        .spyOn(AccessReport.prototype, "decrypt")
        .mockReturnValue(of({ view: decryptedView, hadLegacyBlobs: false }));
      return decryptedView;
    }

    it("should return null if the API returns 404", async () => {
      mockApiService.getLatestReport$.mockReturnValue(
        throwError(() => new ErrorResponse({ Message: "Not found" }, 404)),
      );

      const result = await firstValueFrom(service.loadReport$(organizationId));

      expect(result).toBeNull();
    });

    it("should propagate non-404 API errors", async () => {
      mockApiService.getLatestReport$.mockReturnValue(
        throwError(() => new ErrorResponse({ Message: "Server error" }, 500)),
      );

      await expect(firstValueFrom(service.loadReport$(organizationId))).rejects.toBeInstanceOf(
        ErrorResponse,
      );
    });

    it("should throw if contentEncryptionKey is missing", async () => {
      mockApiService.getLatestReport$.mockReturnValue(
        of(makeApiResponse({ contentEncryptionKey: "" })),
      );

      await expect(firstValueFrom(service.loadReport$(organizationId))).rejects.toThrow(
        "Report encryption key not found",
      );
    });

    it("should use inline reportData when reportFileDownloadUrl is absent (V1 fallback)", async () => {
      const apiResponse = makeApiResponse({ reportData: "inline-report-data" });
      mockApiService.getLatestReport$.mockReturnValue(of(apiResponse));
      mockDecrypt();

      await firstValueFrom(service.loadReport$(organizationId));

      expect(mockApiService.downloadReportFile$).not.toHaveBeenCalled();
      expect(mockApiService.getReportFileData$).not.toHaveBeenCalled();
    });

    it("should download file from Azure blob URL when reportFileDownloadUrl is an Azure URL", async () => {
      const azureUrl = "https://myaccount.blob.core.windows.net/container/report.json?sas=token";
      const apiResponse = makeApiResponse({ reportFileDownloadUrl: azureUrl });
      mockApiService.getLatestReport$.mockReturnValue(of(apiResponse));
      mockApiService.downloadReportFile$.mockReturnValue(of("file-content"));
      mockDecrypt();

      await firstValueFrom(service.loadReport$(organizationId));

      expect(mockApiService.downloadReportFile$).toHaveBeenCalledWith(azureUrl);
      expect(mockApiService.getReportFileData$).not.toHaveBeenCalled();
    });

    it("should fetch file via authenticated API when reportFileDownloadUrl is a non-Azure URL", async () => {
      const serverUrl = "https://my-selfhosted-server.com/reports/download/file-id";
      const apiResponse = makeApiResponse({ reportFileDownloadUrl: serverUrl });
      mockApiService.getLatestReport$.mockReturnValue(of(apiResponse));
      mockApiService.getReportFileData$.mockReturnValue(of("file-content"));
      mockDecrypt();

      await firstValueFrom(service.loadReport$(organizationId));

      expect(mockApiService.getReportFileData$).toHaveBeenCalledWith(organizationId, reportId);
      expect(mockApiService.downloadReportFile$).not.toHaveBeenCalled();
    });

    it("should decrypt and return the report view", async () => {
      mockApiService.getLatestReport$.mockReturnValue(of(makeApiResponse()));
      const expectedView = mockDecrypt();

      const result = await firstValueFrom(service.loadReport$(organizationId));

      expect(result).not.toBeNull();
      expect(result!.report).toBe(expectedView);
      expect(result!.hadLegacyBlobs).toBe(false);
    });

    it("should propagate decryption errors", async () => {
      mockApiService.getLatestReport$.mockReturnValue(of(makeApiResponse()));
      jest
        .spyOn(AccessReport.prototype, "decrypt")
        .mockReturnValue(throwError(() => new Error("Decryption failed")));

      await expect(firstValueFrom(service.loadReport$(organizationId))).rejects.toThrow(
        "Decryption failed",
      );
    });

    it("should throw if user ID is not found", async () => {
      mockAccountService.activeAccount$ = of(null as any);

      await expect(firstValueFrom(service.loadReport$(organizationId))).rejects.toThrow(
        "Null or undefined account",
      );
    });
  });
});
