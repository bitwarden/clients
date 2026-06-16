import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of, throwError } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import {
  FileUploadApiMethods,
  FileUploadService,
} from "@bitwarden/common/platform/abstractions/file-upload/file-upload.service";
import { FileUploadType, EncryptionType } from "@bitwarden/common/platform/enums";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { makeEncString } from "@bitwarden/common/spec";
import { OrganizationId, OrganizationReportId, UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import {
  AccessReport,
  AccessReportApi,
  AccessReportFileApi,
  AccessReportSummaryView,
  AccessReportView,
} from "../../../../access-intelligence/models";
import {
  createAccessReportMetrics,
  createRiskInsights,
  createRiskInsightsSummary,
} from "../../../../reports/risk-insights/testing/test-helpers";
import { AccessIntelligenceApiService } from "../../abstractions/access-intelligence-api.service";
import {
  AccessReportEncryptionService,
  DecryptedAccessReportData,
  FileEncryptedDataWithKey,
} from "../../abstractions/access-report-encryption.service";

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

  function makeEncArrayBuffer(): EncArrayBuffer {
    return EncArrayBuffer.fromParts(
      EncryptionType.AesCbc256_HmacSha256_B64,
      new Uint8Array(16),
      new Uint8Array(32),
      new Uint8Array(32),
    );
  }

  function makeFileEncryptedData(): FileEncryptedDataWithKey {
    return {
      organizationId,
      encryptedReportData: makeEncArrayBuffer(),
      encryptedFileName: makeEncString("enc-filename"),
      encryptedSummaryData: makeEncString("enc-summary"),
      encryptedApplicationData: makeEncString("enc-apps"),
      contentEncryptionKey: makeEncString("enc-key"),
    };
  }

  const mockDecryptedData: DecryptedAccessReportData = {
    reportData: { reports: [], memberRegistry: {} },
    summaryData: new AccessReportSummaryView(),
    applicationData: [],
  };

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
      mockEncryptionService.encryptReportFile$.mockReturnValue(of(makeFileEncryptedData()));
      mockApiService.createReport$.mockReturnValue(of(makeCreateResponse()));
      mockFileUploadService.upload.mockResolvedValue(undefined);

      const result = await firstValueFrom(service.saveReport$(view, organizationId));

      expect(result.id).toBe(reportId);
      expect(result.contentEncryptionKey).toBeDefined();
      expect(mockEncryptionService.encryptReportFile$).toHaveBeenCalledWith(
        { organizationId, userId },
        view.toEncryptionPayload(),
        view.contentEncryptionKey,
      );
      expect(mockApiService.createReport$).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          contentEncryptionKey: expect.any(String),
          fileSize: expect.any(Number),
        }),
      );
    });

    it("should pass upload URL, encrypted filename, and EncArrayBuffer to fileUploadService", async () => {
      const view = createRiskInsights({ organizationId });
      const encryptedData = makeFileEncryptedData();
      mockEncryptionService.encryptReportFile$.mockReturnValue(of(encryptedData));
      mockApiService.createReport$.mockReturnValue(
        of(makeCreateResponse("https://azure.blob/upload", FileUploadType.Azure)),
      );
      mockFileUploadService.upload.mockResolvedValue(undefined);

      await firstValueFrom(service.saveReport$(view, organizationId));

      expect(mockFileUploadService.upload).toHaveBeenCalledWith(
        { url: "https://azure.blob/upload", fileUploadType: FileUploadType.Azure },
        encryptedData.encryptedFileName,
        encryptedData.encryptedReportData,
        expect.objectContaining({
          postDirect: expect.any(Function),
          renewFileUploadUrl: expect.any(Function),
          rollback: expect.any(Function),
        }),
      );
    });

    it("should throw if user ID is not found", async () => {
      mockAccountService.activeAccount$ = of(null as any);
      const view = createRiskInsights({ organizationId });

      await expect(firstValueFrom(service.saveReport$(view, organizationId))).rejects.toThrow(
        "Null or undefined account",
      );
    });

    it("should propagate encryption errors", async () => {
      const view = createRiskInsights({ organizationId });
      mockEncryptionService.encryptReportFile$.mockReturnValue(
        throwError(() => new Error("Encryption failed")),
      );

      await expect(firstValueFrom(service.saveReport$(view, organizationId))).rejects.toThrow(
        "Encryption failed",
      );
    });

    it("should propagate createReport$ errors", async () => {
      const view = createRiskInsights({ organizationId });
      mockEncryptionService.encryptReportFile$.mockReturnValue(of(makeFileEncryptedData()));
      mockApiService.createReport$.mockReturnValue(throwError(() => new Error("API error")));

      await expect(firstValueFrom(service.saveReport$(view, organizationId))).rejects.toThrow(
        "API error",
      );
    });

    it("should propagate file upload errors", async () => {
      const view = createRiskInsights({ organizationId });
      mockEncryptionService.encryptReportFile$.mockReturnValue(of(makeFileEncryptedData()));
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
        mockEncryptionService.encryptReportFile$.mockReturnValue(of(makeFileEncryptedData()));
        mockApiService.createReport$.mockReturnValue(of(makeCreateResponse()));
        mockFileUploadService.upload.mockImplementation(
          async (_uploadData, _name, _file, methods) => {
            capturedMethods = methods;
          },
        );

        await firstValueFrom(service.saveReport$(view, organizationId));
      });

      it("postDirect callback should call uploadReportFile$ with correct args", async () => {
        mockApiService.uploadReportFile$.mockReturnValue(of(undefined));

        await capturedMethods.postDirect(new FormData());

        expect(mockApiService.uploadReportFile$).toHaveBeenCalledWith(
          organizationId,
          reportId,
          reportFileId,
          expect.any(FormData),
        );
      });

      it("renewFileUploadUrl callback should call renewReportFileUpload$ and return the new URL", async () => {
        const newUrl = "https://storage.example.com/renewed";
        const renewResponse = new AccessReportFileApi({
          ReportFileUploadUrl: newUrl,
          FileUploadType: FileUploadType.Azure,
          ReportResponse: { Id: reportId, OrganizationId: organizationId },
        });
        mockApiService.renewReportFileUploadLink$.mockReturnValue(of(renewResponse));

        const url = await capturedMethods.renewFileUploadUrl();

        expect(url).toBe(newUrl);
        expect(mockApiService.renewReportFileUploadLink$).toHaveBeenCalledWith(
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
    function makeMockDomain(): AccessReport {
      const domain = new AccessReport();
      domain.reports = makeEncString("encrypted-reports");
      domain.summary = makeEncString("encrypted-summary");
      domain.applications = makeEncString("encrypted-apps");
      domain.contentEncryptionKey = makeEncString("encryption-key");
      domain.creationDate = new Date();
      return domain;
    }

    it("should call updateReportSettings$ with encrypted application data, summary, and metrics", async () => {
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
      jest.spyOn(AccessReport, "fromView$").mockReturnValue(of(makeMockDomain()));

      mockApiService.updateReportSettings$.mockReturnValue(of({} as AccessReportApi));

      await firstValueFrom(service.saveApplicationMetadata$(view));

      expect(mockApiService.updateReportSettings$).toHaveBeenCalledWith(
        organizationId,
        reportId,
        expect.objectContaining({
          applicationData: expect.any(String),
          summaryData: expect.any(String),
          reportMetrics: expect.any(Object),
          contentEncryptionKey: expect.any(String),
        }),
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
        .spyOn(AccessReport, "fromView$")
        .mockReturnValue(throwError(() => new Error("Encryption failed")));

      await expect(firstValueFrom(service.saveApplicationMetadata$(view))).rejects.toThrow(
        "Encryption failed",
      );
    });

    it("should propagate API update errors", async () => {
      const view = createRiskInsights({ id: reportId, organizationId });
      jest.spyOn(AccessReport, "fromView$").mockReturnValue(of(makeMockDomain()));
      jest.spyOn(view, "toMetrics").mockReturnValue(createAccessReportMetrics({}));

      mockApiService.updateReportSettings$.mockReturnValue(
        throwError(() => new Error("Update failed")),
      );

      await expect(firstValueFrom(service.saveApplicationMetadata$(view))).rejects.toThrow(
        "Update failed",
      );
    });
  });

  describe("loadLastReport$", () => {
    function makeApiResponse(overrides: Partial<AccessReportApi> = {}): AccessReportApi {
      const response = new AccessReportApi();
      response.id = reportId;
      response.organizationId = organizationId;
      response.contentEncryptionKey = "enc-key";
      response.summary = "encrypted-summary";
      response.applications = "encrypted-apps";
      response.creationDate = "2024-01-01T00:00:00Z";
      Object.assign(response, overrides);
      return response;
    }

    function mockDecrypt(view?: AccessReportView) {
      const decryptedView = view ?? createRiskInsights({ id: reportId, organizationId });
      jest
        .spyOn(AccessReport.prototype, "decrypt$")
        .mockReturnValue(of({ view: decryptedView, hadLegacyBlobs: false }));
      return decryptedView;
    }

    function mockFileDecrypt() {
      jest.spyOn(EncArrayBuffer, "fromResponse").mockResolvedValue(makeEncArrayBuffer());
      mockEncryptionService.decryptReportFile$.mockReturnValue(of(mockDecryptedData));
    }

    it("should return null if the API returns 404", async () => {
      mockApiService.getLatestReport$.mockReturnValue(
        throwError(() => new ErrorResponse({ Message: "Not found" }, 404)),
      );

      const result = await firstValueFrom(service.loadLastReport$(organizationId));

      expect(result).toBeNull();
    });

    it("should propagate non-404 API errors", async () => {
      mockApiService.getLatestReport$.mockReturnValue(
        throwError(() => new ErrorResponse({ Message: "Server error" }, 500)),
      );

      await expect(firstValueFrom(service.loadLastReport$(organizationId))).rejects.toBeInstanceOf(
        ErrorResponse,
      );
    });

    it("should throw if contentEncryptionKey is missing", async () => {
      mockApiService.getLatestReport$.mockReturnValue(
        of(makeApiResponse({ contentEncryptionKey: "" })),
      );

      await expect(firstValueFrom(service.loadLastReport$(organizationId))).rejects.toThrow(
        "Report encryption key not found",
      );
    });

    it("should use inline reportData when reportFileDownloadUrl is absent (V1 fallback)", async () => {
      const apiResponse = makeApiResponse({ reports: "inline-report-data" });
      mockApiService.getLatestReport$.mockReturnValue(of(apiResponse));
      mockDecrypt();

      await firstValueFrom(service.loadLastReport$(organizationId));

      expect(mockApiService.downloadReportFile$).not.toHaveBeenCalled();
      expect(mockApiService.downloadReportFileAzure$).not.toHaveBeenCalled();
    });

    it("should download file from Azure blob URL when fileUploadType is Azure", async () => {
      const azureUrl = "https://myaccount.blob.core.windows.net/container/report.json?sas=token";
      const apiResponse = makeApiResponse({
        reportFileDownloadUrl: azureUrl,
        fileUploadType: FileUploadType.Azure,
      });
      mockApiService.getLatestReport$.mockReturnValue(of(apiResponse));
      mockApiService.downloadReportFileAzure$.mockReturnValue(
        of({ blob: new Blob(), fileName: "report.json" }),
      );
      mockFileDecrypt();

      await firstValueFrom(service.loadLastReport$(organizationId));

      expect(mockApiService.downloadReportFileAzure$).toHaveBeenCalledWith(azureUrl);
      expect(mockApiService.downloadReportFile$).not.toHaveBeenCalled();
    });

    it("should fetch file via authenticated API when fileUploadType is Direct", async () => {
      const serverUrl = "https://my-selfhosted-server.com/reports/download/file-id";
      const apiResponse = makeApiResponse({
        reportFileDownloadUrl: serverUrl,
        fileUploadType: FileUploadType.Direct,
      });
      mockApiService.getLatestReport$.mockReturnValue(of(apiResponse));
      mockApiService.downloadReportFile$.mockReturnValue(
        of({ blob: new Blob(), fileName: "report.json" }),
      );
      mockFileDecrypt();

      await firstValueFrom(service.loadLastReport$(organizationId));

      expect(mockApiService.downloadReportFile$).toHaveBeenCalledWith(organizationId, reportId);
      expect(mockApiService.downloadReportFileAzure$).not.toHaveBeenCalled();
    });

    it("should call decryptReportFile$ with EncArrayBuffer and EncString fields for V2 path", async () => {
      const apiResponse = makeApiResponse({
        reportFileDownloadUrl: "https://example.com/file",
        fileUploadType: FileUploadType.Azure,
      });
      mockApiService.getLatestReport$.mockReturnValue(of(apiResponse));
      mockApiService.downloadReportFileAzure$.mockReturnValue(
        of({ blob: new Blob(), fileName: "report.json" }),
      );
      const encBuf = makeEncArrayBuffer();
      jest.spyOn(EncArrayBuffer, "fromResponse").mockResolvedValue(encBuf);
      mockEncryptionService.decryptReportFile$.mockReturnValue(of(mockDecryptedData));

      await firstValueFrom(service.loadLastReport$(organizationId));

      expect(mockEncryptionService.decryptReportFile$).toHaveBeenCalledWith(
        { organizationId, userId },
        encBuf,
        expect.objectContaining({ encryptedString: apiResponse.summary }),
        expect.objectContaining({ encryptedString: apiResponse.applications }),
        expect.objectContaining({ encryptedString: apiResponse.contentEncryptionKey }),
      );
    });

    it("should decrypt and return the report view (V1 fallback)", async () => {
      mockApiService.getLatestReport$.mockReturnValue(of(makeApiResponse()));
      const expectedView = mockDecrypt();

      const result = await firstValueFrom(service.loadLastReport$(organizationId));

      expect(result).not.toBeNull();
      expect(result!.report).toBe(expectedView);
      expect(result!.hadLegacyBlobs).toBe(false);
    });

    it("should map decrypted data to AccessReportView for V2 file path", async () => {
      const apiResponse = makeApiResponse({
        reportFileDownloadUrl: "https://example.com/file",
        fileUploadType: FileUploadType.Azure,
      });
      mockApiService.getLatestReport$.mockReturnValue(of(apiResponse));
      mockApiService.downloadReportFileAzure$.mockReturnValue(
        of({ blob: new Blob(), fileName: "report.json" }),
      );
      mockFileDecrypt();

      const result = await firstValueFrom(service.loadLastReport$(organizationId));

      expect(result).not.toBeNull();
      expect(result!.report.id).toBe(reportId);
      expect(result!.report.organizationId).toBe(organizationId);
      expect(result!.hadLegacyBlobs).toBe(false);
    });

    it("should propagate decryption errors (V1 fallback)", async () => {
      mockApiService.getLatestReport$.mockReturnValue(of(makeApiResponse()));
      jest
        .spyOn(AccessReport.prototype, "decrypt$")
        .mockReturnValue(throwError(() => new Error("Decryption failed")));

      await expect(firstValueFrom(service.loadLastReport$(organizationId))).rejects.toThrow(
        "Decryption failed",
      );
    });

    it("should propagate decryptReportFile$ errors (V2 file path)", async () => {
      const apiResponse = makeApiResponse({
        reportFileDownloadUrl: "https://example.com/file",
        fileUploadType: FileUploadType.Azure,
      });
      mockApiService.getLatestReport$.mockReturnValue(of(apiResponse));
      mockApiService.downloadReportFileAzure$.mockReturnValue(
        of({ blob: new Blob(), fileName: "report.json" }),
      );
      jest.spyOn(EncArrayBuffer, "fromResponse").mockResolvedValue(makeEncArrayBuffer());
      mockEncryptionService.decryptReportFile$.mockReturnValue(
        throwError(() => new Error("File decryption failed")),
      );

      await expect(firstValueFrom(service.loadLastReport$(organizationId))).rejects.toThrow(
        "File decryption failed",
      );
    });

    it("should throw if user ID is not found", async () => {
      mockAccountService.activeAccount$ = of(null as any);

      await expect(firstValueFrom(service.loadLastReport$(organizationId))).rejects.toThrow(
        "Null or undefined account",
      );
    });
  });
});
