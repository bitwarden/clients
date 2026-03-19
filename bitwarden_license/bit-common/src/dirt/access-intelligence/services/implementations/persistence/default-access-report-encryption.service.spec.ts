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

import { AccessReportSettingsData } from "../../../../access-intelligence/models";
import { mockSummaryData } from "../../../../reports/risk-insights/models/mocks/mock-data";
import {
  AccessReportPayload,
  DecryptedAccessReportData,
  EncryptedReportData,
} from "../../abstractions/access-report-encryption.service";
import { UnsupportedVersionError } from "../../abstractions/versioning.service";

import { DefaultAccessReportEncryptionService } from "./default-access-report-encryption.service";
import { ApplicationVersioningService } from "./versioning/application-versioning.service";
import { ReportVersioningService } from "./versioning/report-versioning.service";
import { SummaryVersioningService } from "./versioning/summary-versioning.service";

describe("DefaultAccessReportEncryptionService", () => {
  let service: DefaultAccessReportEncryptionService;
  const mockKeyService = mock<KeyService>();
  const mockEncryptService = mock<EncryptService>();
  const mockKeyGenerationService = mock<KeyGenerationService>();
  const mockLogService = mock<LogService>();
  const mockReportVersioningService = mock<ReportVersioningService>();
  const mockApplicationVersioningService = mock<ApplicationVersioningService>();
  const mockSummaryVersioningService = mock<SummaryVersioningService>();

  const ENCRYPTED_TEXT = "This data has been encrypted";
  const ENCRYPTED_KEY = "Re-encrypted Cipher Key";
  const SERIALIZED_REPORT = '{"version":1,"data":{"serialized":"report"}}';
  const SERIALIZED_SUMMARY = '{"version":1,"data":{"serialized":"summary"}}';
  const SERIALIZED_APPLICATION = '{"version":1,"data":{"serialized":"application"}}';

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

  const mockV2ApplicationData: AccessReportSettingsData[] = [
    {
      applicationName: "application1.com",
      isCritical: true,
      reviewedDate: "2024-01-15T10:30:00.000Z",
    },
    { applicationName: "application2.com", isCritical: false, reviewedDate: undefined },
  ];

  const mockV2Input: DecryptedAccessReportData = {
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
      mockReportVersioningService,
      mockApplicationVersioningService,
      mockSummaryVersioningService,
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

    // Versioning service serialize mocks
    mockReportVersioningService.serialize.mockReturnValue(SERIALIZED_REPORT);
    mockSummaryVersioningService.serialize.mockReturnValue(SERIALIZED_SUMMARY);
    mockApplicationVersioningService.serialize.mockReturnValue(SERIALIZED_APPLICATION);

    // Versioning service process mocks — return valid data by default
    mockReportVersioningService.process.mockReturnValue({
      data: mockV2ReportData,
      wasLegacy: false,
    });
    mockSummaryVersioningService.process.mockReturnValue({
      data: mockSummaryData,
      wasLegacy: false,
    });
    mockApplicationVersioningService.process.mockReturnValue({
      data: mockV2ApplicationData,
      wasLegacy: false,
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
      expect(mockReportVersioningService.serialize).toHaveBeenCalledWith(mockV2Input.reportData);
      expect(mockSummaryVersioningService.serialize).toHaveBeenCalledWith(mockV2Input.summaryData);
      expect(mockApplicationVersioningService.serialize).toHaveBeenCalledWith(
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

      expect(result.reportData.reports).toHaveLength(1);
      expect(result.reportData.reports[0].applicationName).toBe("app.com");
      expect(result.reportData.memberRegistry).toHaveProperty("user-1");
      expect(result.summaryData).toEqual(mockSummaryData);
      expect(result.hadLegacyBlobs).toBeUndefined();
    });

    it("should set hadLegacyBlobs when any blob was legacy", async () => {
      mockReportVersioningService.process.mockReturnValue({
        data: mockV2ReportData,
        wasLegacy: true,
      });

      const result = await firstValueFrom(
        service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
      );

      expect(result.hadLegacyBlobs).toBe(true);
    });

    it("should throw when report format is not recognized", async () => {
      mockReportVersioningService.process.mockImplementation(() => {
        throw new UnsupportedVersionError(undefined);
      });

      await expect(
        firstValueFrom(
          service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
        ),
      ).rejects.toThrow(UnsupportedVersionError);
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
      mockSummaryVersioningService.process.mockImplementation(() => {
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
      mockApplicationVersioningService.process.mockImplementation(() => {
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

      mockApplicationVersioningService.process.mockReturnValue({
        data: [],
        wasLegacy: false,
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
    it("should decrypt summary data and return AccessReportSummaryData", async () => {
      const result = await firstValueFrom(
        service.decryptSummary$(
          { organizationId: orgId, userId },
          new EncString("encrypted-summary"),
          mockKey,
        ),
      );

      expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
      expect(mockEncryptService.unwrapSymmetricKey).toHaveBeenCalledWith(mockKey, orgKey);
      expect(mockSummaryVersioningService.process).toHaveBeenCalled();
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
      mockSummaryVersioningService.process.mockImplementation(() => {
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
