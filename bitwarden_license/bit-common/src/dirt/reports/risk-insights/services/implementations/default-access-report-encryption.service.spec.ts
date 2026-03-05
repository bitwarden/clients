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
  DecryptedAccessReportData,
  AccessReportPayload,
} from "../abstractions/access-report-encryption.service";

import { DefaultAccessReportEncryptionService } from "./default-access-report-encryption.service";

describe("DefaultAccessReportEncryptionService", () => {
  let service: DefaultAccessReportEncryptionService;
  const mockKeyService = mock<KeyService>();
  const mockEncryptService = mock<EncryptService>();
  const mockKeyGenerationService = mock<KeyGenerationService>();
  const mockLogService = mock<LogService>();

  const ENCRYPTED_TEXT = "This data has been encrypted";
  const ENCRYPTED_KEY = "Re-encrypted Cipher Key";
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

  // Report payload as stored in the encrypted blob — includes version discriminant
  const mockV2ReportBlob = { version: 2 as const, ...mockV2ReportData };

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
      mockLogService,
    );

    jest.clearAllMocks();

    mockKeyGenerationService.createKey.mockResolvedValue(contentEncryptionKey);
    mockEncryptService.wrapSymmetricKey.mockResolvedValue(new EncString(ENCRYPTED_KEY));
    mockEncryptService.encryptString.mockResolvedValue(new EncString(ENCRYPTED_TEXT));
    mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);
    mockKeyService.orgKeys$.mockReturnValue(orgKey$);

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
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify(mockV2ReportBlob),
        contentEncryptionKey,
      );
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify(mockV2Input.summaryData),
        contentEncryptionKey,
      );
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify(mockV2Input.applicationData),
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
      mockEncryptService.decryptString
        .mockResolvedValueOnce(JSON.stringify(mockV2ReportBlob))
        .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
        .mockResolvedValueOnce(JSON.stringify(mockV2ApplicationData));

      const result = await firstValueFrom(
        service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
      );

      expect(result.version).toBe(2);
      expect(result.reportData.reports).toHaveLength(1);
      expect(result.reportData.reports[0].applicationName).toBe("app.com");
      expect(result.reportData.memberRegistry).toHaveProperty("user-1");
      expect(result.summaryData).toEqual(mockSummaryData);
    });

    it("should throw when report format is not recognized", async () => {
      const v1ReportData = [
        {
          applicationName: "app.com",
          passwordCount: 1,
          atRiskPasswordCount: 0,
          memberDetails: [] as unknown[],
          atRiskMemberDetails: [] as unknown[],
          cipherIds: [] as unknown[],
          atRiskCipherIds: [] as unknown[],
          memberCount: 0,
          atRiskMemberCount: 0,
        },
      ];

      mockEncryptService.decryptString.mockResolvedValueOnce(JSON.stringify(v1ReportData));

      await expect(
        firstValueFrom(
          service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
        ),
      ).rejects.toThrow("Legacy report detected, migration required.");
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
      mockEncryptService.decryptString.mockReset();
      mockEncryptService.decryptString
        .mockResolvedValueOnce(JSON.stringify(mockV2ReportBlob))
        .mockResolvedValueOnce(JSON.stringify({ invalid: "summary" }));

      await expect(
        firstValueFrom(
          service.decryptReport$({ organizationId: orgId, userId }, mockEncryptedData, mockKey),
        ),
      ).rejects.toThrow(
        /Summary data validation failed.*This may indicate data corruption or tampering/,
      );
    });

    it("should throw when application data validation fails", async () => {
      mockEncryptService.decryptString.mockReset();
      mockEncryptService.decryptString
        .mockResolvedValueOnce(JSON.stringify(mockV2ReportBlob))
        .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
        .mockResolvedValueOnce(JSON.stringify([{ invalid: "app" }]));

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

      mockEncryptService.decryptString.mockResolvedValueOnce(JSON.stringify(mockV2ReportBlob));

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

      mockEncryptService.decryptString
        .mockResolvedValueOnce(JSON.stringify(mockV2ReportBlob))
        .mockResolvedValueOnce(JSON.stringify(mockSummaryData));

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
      mockEncryptService.decryptString.mockResolvedValueOnce(JSON.stringify(mockSummaryData));

      const result = await firstValueFrom(
        service.decryptSummary$(
          { organizationId: orgId, userId },
          new EncString("encrypted-summary"),
          mockKey,
        ),
      );

      expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
      expect(mockEncryptService.unwrapSymmetricKey).toHaveBeenCalledWith(mockKey, orgKey);
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
      mockEncryptService.decryptString.mockResolvedValueOnce(
        JSON.stringify({ invalid: "summary" }),
      );

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
