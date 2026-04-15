import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { FileUploadType } from "@bitwarden/common/platform/enums";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import {
  AccessReportApi,
  AccessReportFileApi,
  AccessReportMetricsApi,
  AccessReportSummaryApi,
} from "../../../models";
import {
  AccessReportCreateRequest,
  AccessReportLegacyCreateRequest,
  AccessReportSettingsUpdateRequest,
} from "../../abstractions/access-intelligence-api.service";

import { DefaultAccessIntelligenceApiService } from "./default-access-intelligence-api.service";

describe("DefaultAccessIntelligenceApiService", () => {
  let service: DefaultAccessIntelligenceApiService;
  let mockApiService: MockProxy<ApiService>;

  const orgId = "org-123" as OrganizationId;
  const reportId = "report-456" as OrganizationReportId;
  const reportFileId = "file-789";
  const mockMetrics = new AccessReportMetricsApi({
    totalApplicationCount: 10,
    totalAtRiskApplicationCount: 3,
    totalCriticalApplicationCount: 2,
    totalCriticalAtRiskApplicationCount: 1,
    totalMemberCount: 50,
    totalAtRiskMemberCount: 12,
    totalCriticalMemberCount: 5,
    totalCriticalAtRiskMemberCount: 2,
    totalPasswordCount: 200,
    totalAtRiskPasswordCount: 40,
    totalCriticalPasswordCount: 15,
    totalCriticalAtRiskPasswordCount: 5,
  });

  beforeEach(() => {
    mockApiService = mock<ApiService>();
    service = new DefaultAccessIntelligenceApiService(mockApiService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getLatestReport$", () => {
    it("should call GET /reports/organizations/{orgId}/latest and return AccessReportApi", async () => {
      const rawResponse = {
        id: reportId,
        organizationId: orgId,
        creationDate: "2024-01-01T00:00:00Z",
        reportData: "encrypted-reports",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-apps",
        contentEncryptionKey: "enc-key",
      };
      mockApiService.send.mockResolvedValue(rawResponse);

      const result = await firstValueFrom(service.getLatestReport$(orgId));

      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/organizations/${orgId}/latest`,
        null,
        true,
        true,
      );
      expect(result).toBeInstanceOf(AccessReportApi);
      expect(result.id).toBe(reportId);
      expect(result.organizationId).toBe(orgId);
    });

    it("should propagate API errors", async () => {
      mockApiService.send.mockRejectedValue(new Error("Network error"));

      await expect(firstValueFrom(service.getLatestReport$(orgId))).rejects.toThrow(
        "Network error",
      );
    });
  });

  describe("createReport$", () => {
    it("should call POST /reports/organizations/{orgId} and return AccessReportFileApi", async () => {
      const rawResponse = {
        reportFileUploadUrl: "https://storage.example.com/upload",
        fileUploadType: FileUploadType.Azure,
        reportResponse: {
          id: reportId,
          organizationId: orgId,
          creationDate: "2024-01-01T00:00:00Z",
        },
      };
      mockApiService.send.mockResolvedValue(rawResponse);

      const request: AccessReportCreateRequest = {
        fileSize: 1024,
        contentEncryptionKey: "enc-key",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-apps",
        metrics: mockMetrics,
      };

      const result = await firstValueFrom(service.createReport$(orgId, request));

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        `/reports/organizations/${orgId}`,
        request,
        true,
        true,
      );
      expect(result).toBeInstanceOf(AccessReportFileApi);
      expect(result.reportFileUploadUrl).toBe("https://storage.example.com/upload");
      expect(result.fileUploadType).toBe(FileUploadType.Azure);
      expect(result.reportResponse).toBeInstanceOf(AccessReportApi);
    });

    it("should propagate API errors", async () => {
      mockApiService.send.mockRejectedValue(new Error("API error"));

      await expect(firstValueFrom(service.createReport$(orgId, {} as any))).rejects.toThrow(
        "API error",
      );
    });
  });

  describe("createLegacyReport$", () => {
    it("should call POST /reports/organizations/{orgId} and return AccessReportApi", async () => {
      const rawResponse = {
        id: reportId,
        organizationId: orgId,
        creationDate: "2024-01-01T00:00:00Z",
        reportData: "encrypted-report-data",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-apps",
        contentEncryptionKey: "enc-key",
      };
      mockApiService.send.mockResolvedValue(rawResponse);

      const request: AccessReportLegacyCreateRequest = {
        reportData: "encrypted-report-data",
        contentEncryptionKey: "enc-key",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-apps",
        metrics: mockMetrics,
      };

      const result = await firstValueFrom(service.createLegacyReport$(orgId, request));

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        `/reports/organizations/${orgId}`,
        request,
        true,
        true,
      );
      expect(result).toBeInstanceOf(AccessReportApi);
      expect(result.id).toBe(reportId);
      expect(result.organizationId).toBe(orgId);
    });

    it("should propagate API errors", async () => {
      mockApiService.send.mockRejectedValue(new Error("API error"));

      await expect(firstValueFrom(service.createLegacyReport$(orgId, {} as any))).rejects.toThrow(
        "API error",
      );
    });
  });

  describe("updateSummaryData$", () => {
    it("should call PATCH /reports/organizations/{orgId}/data/summary/{reportId} and return AccessReportApi", async () => {
      const rawResponse = {
        id: reportId,
        organizationId: orgId,
        creationDate: "2024-01-01T00:00:00Z",
        summaryData: "encrypted-summary",
        contentEncryptionKey: "enc-key",
      };
      mockApiService.send.mockResolvedValue(rawResponse);

      const summaryData = "encrypted-summary-data";
      const metrics = mockMetrics;

      const result = await firstValueFrom(
        service.updateSummaryData$(orgId, reportId, summaryData, metrics),
      );

      expect(mockApiService.send).toHaveBeenCalledWith(
        "PATCH",
        `/reports/organizations/${orgId}/data/summary/${reportId}`,
        expect.objectContaining({ summaryData, metrics }),
        true,
        true,
      );
      expect(result).toBeInstanceOf(AccessReportApi);
      expect(result.id).toBe(reportId);
    });

    it("should propagate API errors", async () => {
      mockApiService.send.mockRejectedValue(new Error("Update failed"));

      await expect(
        firstValueFrom(service.updateSummaryData$(orgId, reportId, "data")),
      ).rejects.toThrow("Update failed");
    });
  });

  describe("updateApplicationData$", () => {
    it("should call PATCH /reports/organizations/{orgId}/data/application/{reportId} and return AccessReportApi", async () => {
      const rawResponse = {
        id: reportId,
        organizationId: orgId,
        creationDate: "2024-01-01T00:00:00Z",
        applicationData: "encrypted-apps",
        contentEncryptionKey: "enc-key",
      };
      mockApiService.send.mockResolvedValue(rawResponse);

      const applicationData = "encrypted-app-data";

      const result = await firstValueFrom(
        service.updateApplicationData$(orgId, reportId, applicationData),
      );

      expect(mockApiService.send).toHaveBeenCalledWith(
        "PATCH",
        `/reports/organizations/${orgId}/data/application/${reportId}`,
        expect.objectContaining({ applicationData }),
        true,
        true,
      );
      expect(result).toBeInstanceOf(AccessReportApi);
      expect(result.id).toBe(reportId);
    });

    it("should propagate API errors", async () => {
      mockApiService.send.mockRejectedValue(new Error("Update failed"));

      await expect(
        firstValueFrom(service.updateApplicationData$(orgId, reportId, "data")),
      ).rejects.toThrow("Update failed");
    });
  });

  describe("getSummaryDataByDateRange$", () => {
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    it("should call GET with date range params and return AccessReportSummaryApi[]", async () => {
      const rawResponse = [
        { EncryptedData: "enc-data-1", EncryptionKey: "key-1", Date: "2024-01-15" },
        { EncryptedData: "enc-data-2", EncryptionKey: "key-2", Date: "2024-01-20" },
      ];
      mockApiService.send.mockResolvedValue(rawResponse);

      const result = await firstValueFrom(
        service.getSummaryDataByDateRange$(orgId, startDate, endDate),
      );

      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/organizations/${orgId}/data/summary?startDate=2024-01-01&endDate=2024-01-31`,
        null,
        true,
        true,
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(AccessReportSummaryApi);
      expect(result[0].encryptedData).toBe("enc-data-1");
    });

    it("should return empty array when response is not an array", async () => {
      mockApiService.send.mockResolvedValue(null);

      const result = await firstValueFrom(
        service.getSummaryDataByDateRange$(orgId, startDate, endDate),
      );

      expect(result).toEqual([]);
    });

    it("should return empty array on 404 error", async () => {
      const notFoundError = new ErrorResponse({ Message: "Not found" }, 404);
      mockApiService.send.mockRejectedValue(notFoundError);

      const result = await firstValueFrom(
        service.getSummaryDataByDateRange$(orgId, startDate, endDate),
      );

      expect(result).toEqual([]);
    });

    it("should propagate non-404 errors", async () => {
      const serverError = new ErrorResponse({ Message: "Server error" }, 500);
      mockApiService.send.mockRejectedValue(serverError);

      await expect(
        firstValueFrom(service.getSummaryDataByDateRange$(orgId, startDate, endDate)),
      ).rejects.toBeInstanceOf(ErrorResponse);
    });
  });

  describe("renewReportFileUpload$", () => {
    it("should call GET /reports/organizations/{orgId}/{reportId}/renew-upload and return AccessReportFileApi", async () => {
      const rawResponse = {
        reportFileUploadUrl: "https://storage.example.com/renewed-upload",
        fileUploadType: FileUploadType.Azure,
        reportResponse: {
          id: reportId,
          organizationId: orgId,
          creationDate: "2024-01-01T00:00:00Z",
          contentEncryptionKey: "enc-key",
        },
      };
      mockApiService.send.mockResolvedValue(rawResponse);

      const result = await firstValueFrom(service.renewReportFileUploadLink$(orgId, reportId));

      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/organizations/${orgId}/${reportId}/file/renew`,
        null,
        true,
        true,
      );
      expect(result).toBeInstanceOf(AccessReportFileApi);
      expect(result.reportResponse.id).toBe(reportId);
      expect(result.reportFileUploadUrl).toBe("https://storage.example.com/renewed-upload");
    });

    it("should propagate API errors", async () => {
      mockApiService.send.mockRejectedValue(new Error("Renew failed"));

      await expect(
        firstValueFrom(service.renewReportFileUploadLink$(orgId, reportId)),
      ).rejects.toThrow("Renew failed");
    });
  });

  describe("deleteReport$", () => {
    it("should call DELETE /reports/organizations/{orgId}/{reportId}", async () => {
      mockApiService.send.mockResolvedValue(undefined);

      await firstValueFrom(service.deleteReport$(orgId, reportId));

      expect(mockApiService.send).toHaveBeenCalledWith(
        "DELETE",
        `/reports/organizations/${orgId}/${reportId}`,
        null,
        true,
        false,
      );
    });

    it("should propagate API errors", async () => {
      mockApiService.send.mockRejectedValue(new Error("Delete failed"));

      await expect(firstValueFrom(service.deleteReport$(orgId, reportId))).rejects.toThrow(
        "Delete failed",
      );
    });
  });

  describe("uploadReportFile$", () => {
    it("should call POST /reports/organizations/{orgId}/{reportId}/file/report-data with FormData", async () => {
      mockApiService.send.mockResolvedValue(undefined);

      const file = new File(["file content"], "report.bin", { type: "application/octet-stream" });

      await firstValueFrom(service.uploadReportFile$(orgId, reportId, file, reportFileId));

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        `/reports/organizations/${orgId}/${reportId}/file?reportFileId=${reportFileId}`,
        expect.any(FormData),
        true,
        false,
      );

      const sentFormData: FormData = mockApiService.send.mock.calls[0][2] as FormData;
      expect(sentFormData.get("file")).toBeInstanceOf(File);
      expect((sentFormData.get("file") as File).name).toBe("report.bin");
    });

    it("should propagate API errors", async () => {
      mockApiService.send.mockRejectedValue(new Error("Upload failed"));

      const file = new File(["content"], "report.bin");

      await expect(
        firstValueFrom(service.uploadReportFile$(orgId, reportId, file, reportFileId)),
      ).rejects.toThrow("Upload failed");
    });
  });

  describe("downloadReportFile$", () => {
    it("should call GET /reports/organizations/{orgId}/{reportId}/file/download and return blob with fileName", async () => {
      const blob = new Blob(["file content"], { type: "application/octet-stream" });
      const sendResponse = { blob, fileName: "report.bin" };
      mockApiService.send.mockResolvedValue(sendResponse);

      const result = await firstValueFrom(service.downloadReportFile$(orgId, reportId));

      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/organizations/${orgId}/${reportId}/file/download`,
        null,
        true,
        true,
      );
      expect(result.blob).toBe(blob);
      expect(result.fileName).toBe("report.bin");
    });

    it("should propagate API errors", async () => {
      mockApiService.send.mockRejectedValue(new Error("Download failed"));

      await expect(firstValueFrom(service.downloadReportFile$(orgId, reportId))).rejects.toThrow(
        "Download failed",
      );
    });
  });

  describe("updateReportSettings$", () => {
    it("should call PATCH /reports/organizations/{orgId}/{reportId} and return AccessReportApi", async () => {
      const rawResponse = {
        id: reportId,
        organizationId: orgId,
        creationDate: "2024-01-01T00:00:00Z",
        summaryData: "encrypted-summary",
      };
      mockApiService.send.mockResolvedValue(rawResponse);

      const request: AccessReportSettingsUpdateRequest = {
        summaryData: "encrypted-summary",
        applicationData: "encrypted-apps",
        metrics: mockMetrics,
      };

      const result = await firstValueFrom(service.updateReportSettings$(orgId, reportId, request));

      expect(mockApiService.send).toHaveBeenCalledWith(
        "PATCH",
        `/reports/organizations/${orgId}/${reportId}`,
        request,
        true,
        true,
      );
      expect(result).toBeInstanceOf(AccessReportApi);
      expect(result.id).toBe(reportId);
    });

    it("should propagate API errors", async () => {
      mockApiService.send.mockRejectedValue(new Error("Update failed"));

      await expect(
        firstValueFrom(service.updateReportSettings$(orgId, reportId, {} as any)),
      ).rejects.toThrow("Update failed");
    });
  });
});
