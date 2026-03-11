import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { EncryptedReportData } from "../../models";
import { RiskInsightsApplicationData } from "../../models/data/risk-insights-application.data";
import { mockSummaryData } from "../../models/mocks/mock-data";
import {
  AccessReportPayload,
  DecryptedAccessReportData,
  UnsupportedReportFormatError,
} from "../abstractions/access-report-encryption.service";
import { BlobVersioningService } from "../abstractions/blob-versioning.service";

import { DefaultAccessReportEncryptionService } from "./default-access-report-encryption.service";

describe("DefaultAccessReportEncryptionService", () => {
  let service: DefaultAccessReportEncryptionService;
  const mockKeyService = mock<KeyService>();
  const mockEncryptService = mock<EncryptService>();
  const mockKeyGenerationService = mock<KeyGenerationService>();
  const mockLogService = mock<LogService>();
  const mockBlobVersioningService = mock<BlobVersioningService>();

  const ENCRYPTED_TEXT = "This data has been encrypted";
  const ENCRYPTED_KEY = "Re-encrypted Cipher Key";
  const SERIALIZED_REPORT = '{"version":2,"serialized":"report"}';
  const SERIALIZED_SUMMARY = '{"version":2,"serialized":"summary"}';
  const SERIALIZED_APPLICATION = '{"version":2,"serialized":"application"}';

  const orgId = "org-123" as OrganizationId;
  const userId = "user-123" as UserId;
  const orgKey = makeSymmetricCryptoKey<OrgKey>();
  const contentEncryptionKey = new SymmetricCryptoKey(new Uint8Array(64));
  const OrgRecords: Record<OrganizationId, OrgKey> = {
    [orgId]: orgKey,
  };
  const orgKey$ = new BehaviorSubject(OrgRecords);

  const mockV2ReportData: AccessReportPayload = {
    reports: [
      {
        applicationName: "app.com",
        passwordCount: 3,
        atRiskPasswordCount: 1,
        memberRefs: { "user-1": true, "user-2": false },
        cipherRefs: { "cipher-1": true, "cipher-2": false },
        memberCount: 2,
        atRiskMemberCount: 1,
      },
    ],
    memberRegistry: {
      "user-1": { id: "user-1", userName: "Alice", email: "alice@example.com" },
      "user-2": { id: "user-2", userName: "Bob", email: "bob@example.com" },
    },
  };

  const mockV2ApplicationData: RiskInsightsApplicationData[] = [
    {
      applicationName: "application1.com",
      isCritical: true,
      reviewedDate: "2024-01-15T10:30:00.000Z",
    },
    { applicationName: "application2.com", isCritical: false, reviewedDate: undefined },
  ];

  const mockV2Input: DecryptedAccessReportData = {
    version: 2,
    reportData: mockV2ReportData,
    summaryData: mockSummaryData,
    applicationData: mockV2ApplicationData,
  };

  let mockEncryptedData: EncryptedReportData;
  let mockKey: EncString;

  beforeEach(() => {
    service = new DefaultAccessReportEncryptionService(
      mockKeyService,
      mockEncryptService,
      mockKeyGenerationService,
      mockBlobVersioningService,
      mockLogService,
    );

    jest.clearAllMocks();

    mockKeyGenerationService.createKey.mockResolvedValue(contentEncryptionKey);
    mockEncryptService.wrapSymmetricKey.mockResolvedValue(new EncString(ENCRYPTED_KEY));
    mockEncryptService.encryptString.mockResolvedValue(new EncString(ENCRYPTED_TEXT));
    mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);
    mockKeyService.orgKeys$.mockReturnValue(orgKey$);

    // Default: decryptString returns parseable JSON (overridden per-test as needed)
    mockEncryptService.decryptString.mockResolvedValue("{}");

    // BlobVersioningService serialize mocks
    mockBlobVersioningService.serializeReport.mockReturnValue(SERIALIZED_REPORT);
    mockBlobVersioningService.serializeSummary.mockReturnValue(SERIALIZED_SUMMARY);
    mockBlobVersioningService.serializeApplication.mockReturnValue(SERIALIZED_APPLICATION);

    // BlobVersioningService process mocks — return valid V2 data by default
    mockBlobVersioningService.processReport.mockReturnValue({
      data: mockV2ReportData,
      wasV1: false,
    });
    mockBlobVersioningService.processSummary.mockReturnValue({
      data: mockSummaryData,
      wasV1: false,
    });
    mockBlobVersioningService.processApplication.mockReturnValue({
      data: mockV2ApplicationData,
      wasV1: false,
    });

    mockKey = new EncString("wrapped-key");
    mockEncryptedData = {
      encryptedReportData: new EncString("encrypted-reports"),
      encryptedSummaryData: new EncString("encrypted-summary"),
      encryptedApplicationData: new EncString("encrypted-applications"),
    };
  });

  describe("encryptReport$", () => {
    it("should encrypt V2 data and return EncryptedDataWithKey", async () => {
      const result = await firstValueFrom(
        service.encryptReport$({ organizationId: orgId, userId }, mockV2Input),
      );

      expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
      expect(mockKeyGenerationService.createKey).toHaveBeenCalledWith(512);
      expect(mockBlobVersioningService.serializeReport).toHaveBeenCalledWith(
        mockV2Input.reportData,
      );
      expect(mockBlobVersioningService.serializeSummary).toHaveBeenCalledWith(
        mockV2Input.summaryData,
      );
      expect(mockBlobVersioningService.serializeApplication).toHaveBeenCalledWith(
        mockV2Input.applicationData,
      );
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        SERIALIZED_REPORT,
        contentEncryptionKey,
      );
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        SERIALIZED_SUMMARY,
        contentEncryptionKey,
      );
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        SERIALIZED_APPLICATION,
        contentEncryptionKey,
      );
      expect(mockEncryptService.wrapSymmetricKey).toHaveBeenCalledWith(
        contentEncryptionKey,
        orgKey,
      );

      expect(result).toEqual({
        organizationId: orgId,
        encryptedReportData: new EncString(ENCRYPTED_TEXT),
        encryptedSummaryData: new EncString(ENCRYPTED_TEXT),
        encryptedApplicationData: new EncString(ENCRYPTED_TEXT),
        contentEncryptionKey: new EncString(ENCRYPTED_KEY),
      });
    });

    it("should reuse existing key when wrappedKey is provided", async () => {
      await firstValueFrom(
        service.encryptReport$({ organizationId: orgId, userId }, mockV2Input, mockKey),
      );

      expect(mockKeyGenerationService.createKey).not.toHaveBeenCalled();
      expect(mockEncryptService.unwrapSymmetricKey).toHaveBeenCalledWith(mockKey, orgKey);
    });

    it("should throw if org key is not found", async () => {
      mockKeyService.orgKeys$.mockReturnValue(new BehaviorSubject({}));

      await expect(
        firstValueFrom(service.encryptReport$({ organizationId: orgId, userId }, mockV2Input)),
      ).rejects.toThrow("Organization key not found");
    });

    it("should throw if key operation fails", async () => {
      mockKeyGenerationService.createKey.mockRejectedValue(new Error("Key generation failed"));

      await expect(
        firstValueFrom(service.encryptReport$({ organizationId: orgId, userId }, mockV2Input)),
      ).rejects.toThrow("Failed to get encryption key");
    });

    it("should throw when encrypted strings are empty", async () => {
      mockEncryptService.encryptString.mockResolvedValue(new EncString(""));

      await expect(
        firstValueFrom(service.encryptReport$({ organizationId: orgId, userId }, mockV2Input)),
      ).rejects.toThrow("Encryption failed, encrypted strings are null");
    });
  });

  describe("decryptReport$", () => {
    it("should decrypt V2 data and return DecryptedAccessReportData", async () => {
      const result = await firstValueFrom(
        service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
      );

      expect(result.version).toBe(2);
      expect(result.reportData.reports).toHaveLength(1);
      expect(result.reportData.reports[0].applicationName).toBe("app.com");
      expect(result.reportData.memberRegistry).toHaveProperty("user-1");
      expect(result.summaryData).toEqual(mockSummaryData);
      expect(result.hadLegacyBlobs).toBeUndefined();
    });

    it("should set hadLegacyBlobs when any blob was V1", async () => {
      mockBlobVersioningService.processReport.mockReturnValue({
        data: mockV2ReportData,
        wasV1: true,
      });

      const result = await firstValueFrom(
        service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
      );

      expect(result.hadLegacyBlobs).toBe(true);
    });

    it("should throw when report format is not recognized", async () => {
      mockBlobVersioningService.processReport.mockImplementation(() => {
        throw new UnsupportedReportFormatError(undefined);
      });

      await expect(
        firstValueFrom(
          service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
        ),
      ).rejects.toThrow(UnsupportedReportFormatError);
    });

    it("should throw when report blob is null", async () => {
      const encryptedDataWithNullReport: EncryptedReportData = {
        encryptedReportData: null as unknown as EncString,
        encryptedSummaryData: new EncString("encrypted-summary"),
        encryptedApplicationData: new EncString("encrypted-applications"),
      };

      await expect(
        firstValueFrom(
          service.decryptReport$(
            { organizationId: orgId, userId },
            encryptedDataWithNullReport,
            mockKey,
          ),
        ),
      ).rejects.toThrow("Report data is missing. Run migration before loading this report.");
    });

    it("should throw if org key is not found", async () => {
      mockKeyService.orgKeys$.mockReturnValue(new BehaviorSubject({}));

      await expect(
        firstValueFrom(
          service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
        ),
      ).rejects.toThrow("Organization key not found");
    });

    it("should throw if content encryption key is null after unwrap", async () => {
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(
        null as unknown as SymmetricCryptoKey,
      );

      await expect(
        firstValueFrom(
          service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
        ),
      ).rejects.toThrow("Encryption key not found");
    });

    it("should throw when summary data validation fails", async () => {
      mockBlobVersioningService.processSummary.mockImplementation(() => {
        throw new Error(
          "Summary data validation failed. This may indicate data corruption or tampering.",
        );
      });

      await expect(
        firstValueFrom(
          service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
        ),
      ).rejects.toThrow(
        /Summary data validation failed.*This may indicate data corruption or tampering/,
      );
    });

    it("should throw when application data validation fails", async () => {
      mockBlobVersioningService.processApplication.mockImplementation(() => {
        throw new Error(
          "Application data validation failed. This may indicate data corruption or tampering.",
        );
      });

      await expect(
        firstValueFrom(
          service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
        ),
      ).rejects.toThrow(
        /Application data validation failed.*This may indicate data corruption or tampering/,
      );
    });

    it("should throw when summary blob is null", async () => {
      const encryptedDataWithNullSummary: EncryptedReportData = {
        encryptedReportData: new EncString("encrypted-reports"),
        encryptedSummaryData: null as unknown as EncString,
        encryptedApplicationData: new EncString("encrypted-applications"),
      };

      await expect(
        firstValueFrom(
          service.decryptReport$(
            { organizationId: orgId, userId },
            encryptedDataWithNullSummary,
            mockKey,
          ),
        ),
      ).rejects.toThrow("Summary data not found");
    });

    it("should return empty application array when application blob is null", async () => {
      const encryptedDataWithNullApps: EncryptedReportData = {
        encryptedReportData: new EncString("encrypted-reports"),
        encryptedSummaryData: new EncString("encrypted-summary"),
        encryptedApplicationData: null as unknown as EncString,
      };

      mockBlobVersioningService.processApplication.mockReturnValue({
        data: [],
        wasV1: false,
      });

      const result = await firstValueFrom(
        service.decryptReport$(
          { organizationId: orgId, userId },
          encryptedDataWithNullApps,
          mockKey,
        ),
      );

      expect(result.applicationData).toEqual([]);
    });
  });

  describe("decryptSummary$", () => {
    it("should decrypt summary data and return RiskInsightsSummaryData", async () => {
      const result = await firstValueFrom(
        service.decryptSummary$(
          { organizationId: orgId, userId },
          new EncString("encrypted-summary"),
          mockKey,
        ),
      );

      expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
      expect(mockEncryptService.unwrapSymmetricKey).toHaveBeenCalledWith(mockKey, orgKey);
      expect(mockBlobVersioningService.processSummary).toHaveBeenCalled();
      expect(result).toEqual(mockSummaryData);
    });

    it("should throw if org key is not found", async () => {
      mockKeyService.orgKeys$.mockReturnValue(new BehaviorSubject({}));

      await expect(
        firstValueFrom(
          service.decryptSummary$(
            { organizationId: orgId, userId },
            new EncString("encrypted-summary"),
            mockKey,
          ),
        ),
      ).rejects.toThrow("Organization key not found");
    });

    it("should throw if content encryption key is null after unwrap", async () => {
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(
        null as unknown as SymmetricCryptoKey,
      );

      await expect(
        firstValueFrom(
          service.decryptSummary$(
            { organizationId: orgId, userId },
            new EncString("encrypted-summary"),
            mockKey,
          ),
        ),
      ).rejects.toThrow("Encryption key not found");
    });

    it("should throw when summary blob is null", async () => {
      await expect(
        firstValueFrom(
          service.decryptSummary$(
            { organizationId: orgId, userId },
            null as unknown as EncString,
            mockKey,
          ),
        ),
      ).rejects.toThrow("Summary data not found");
    });

    it("should throw when summary data validation fails", async () => {
      mockBlobVersioningService.processSummary.mockImplementation(() => {
        throw new Error(
          "Summary data validation failed. This may indicate data corruption or tampering.",
        );
      });

      await expect(
        firstValueFrom(
          service.decryptSummary$(
            { organizationId: orgId, userId },
            new EncString("encrypted-summary"),
            mockKey,
          ),
        ),
      ).rejects.toThrow(
        /Summary data validation failed.*This may indicate data corruption or tampering/,
      );
    });
  });
});
