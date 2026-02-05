import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { EncryptedReportData, DecryptedReportData } from "../../models";
import { mockApplicationData, mockReportData, mockSummaryData } from "../../models/mocks/mock-data";

import { RiskInsightsCompressionService } from "./risk-insights-compression.service";
import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";

describe("RiskInsightsEncryptionService", () => {
  let service: RiskInsightsEncryptionService;
  const mockKeyService = mock<KeyService>();
  const mockEncryptService = mock<EncryptService>();
  const mockKeyGenerationService = mock<KeyGenerationService>();
  const mockLogService = mock<LogService>();
  const mockCompressionService = mock<RiskInsightsCompressionService>();

  const ENCRYPTED_TEXT = "This data has been encrypted";
  const COMPRESSED_TEXT = "compressed-data";
  const ENCRYPTED_KEY = "Re-encrypted Cipher Key";
  const orgId = "org-123" as OrganizationId;
  const userId = "user-123" as UserId;
  const orgKey = makeSymmetricCryptoKey<OrgKey>();
  const contentEncryptionKey = new SymmetricCryptoKey(new Uint8Array(64));
  const OrgRecords: Record<OrganizationId, OrgKey> = {
    [orgId]: orgKey,
    ["testOrg" as OrganizationId]: makeSymmetricCryptoKey<OrgKey>(),
  };
  const orgKey$ = new BehaviorSubject(OrgRecords);

  let mockDecryptedData: DecryptedReportData;
  let mockEncryptedData: EncryptedReportData;
  let mockKey: EncString;

  // Helper functions
  const resetDecryptionMocks = () => {
    mockEncryptService.decryptString.mockReset();
    mockCompressionService.isCompressed.mockReset();
    mockCompressionService.decompressString.mockReset();
  };

  const setupBasicDecryption = () => {
    mockKeyService.orgKeys$.mockReturnValue(orgKey$);
    mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);
  };

  const createV2CPayload = (reportData = mockReportData) => ({
    version: 2,
    memberRegistry: {
      "user-id-1": { email: "tom@application1.com", userName: "tom" },
      "user-id-2": { email: "tom2@application1.com", userName: "tom" },
    },
    reports: reportData.map((r) => ({
      applicationName: r.applicationName,
      cipherIds: r.cipherIds,
      passwordCount: r.passwordCount,
      memberIds: [...new Set(r.memberDetails.map((m) => m.userGuid))],
      memberCount: r.memberCount,
      atRiskCipherIds: r.atRiskCipherIds,
      atRiskPasswordCount: r.atRiskPasswordCount,
      atRiskMemberIds: [...new Set(r.atRiskMemberDetails.map((m) => m.userGuid))],
      atRiskMemberCount: r.atRiskMemberCount,
    })),
  });

  beforeEach(() => {
    service = new RiskInsightsEncryptionService(
      mockKeyService,
      mockEncryptService,
      mockKeyGenerationService,
      mockLogService,
      mockCompressionService,
    );

    jest.clearAllMocks();

    // Setup universal mocks used across encryption and decryption tests
    mockKeyService.orgKeys$.mockReturnValue(orgKey$);
    mockKeyGenerationService.createKey.mockResolvedValue(contentEncryptionKey);
    mockEncryptService.wrapSymmetricKey.mockResolvedValue(new EncString(ENCRYPTED_KEY));
    mockEncryptService.encryptString.mockResolvedValue(new EncString(ENCRYPTED_TEXT));
    mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);
    mockCompressionService.compressString.mockResolvedValue(COMPRESSED_TEXT);

    // Setup test data
    mockKey = new EncString("wrapped-key");
    mockEncryptedData = {
      encryptedReportData: new EncString(JSON.stringify(mockReportData)),
      encryptedSummaryData: new EncString(JSON.stringify(mockSummaryData)),
      encryptedApplicationData: new EncString(JSON.stringify(mockApplicationData)),
    };
    mockDecryptedData = {
      reportData: mockReportData,
      summaryData: mockSummaryData,
      applicationData: mockApplicationData,
    };
  });

  describe("encryptRiskInsightsReport", () => {
    it("should encrypt data using V2C format with compression", async () => {
      const result = await service.encryptRiskInsightsReport(
        { organizationId: orgId, userId },
        mockDecryptedData,
      );

      expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
      expect(mockKeyGenerationService.createKey).toHaveBeenCalledWith(512);

      // V2C: Should compress report data before encrypting
      expect(mockCompressionService.compressString).toHaveBeenCalled();
      const compressCall = mockCompressionService.compressString.mock.calls[0][0];
      const compressedPayload = JSON.parse(compressCall);
      expect(compressedPayload.version).toBe(2);
      expect(compressedPayload.memberRegistry).toBeDefined();
      expect(compressedPayload.reports).toBeDefined();

      // Should encrypt the compressed report data
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        COMPRESSED_TEXT,
        contentEncryptionKey,
      );

      // Summary and application data are still encrypted without compression
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify(mockDecryptedData.summaryData),
        contentEncryptionKey,
      );
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify(mockDecryptedData.applicationData),
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

    it("should throw an error when encrypted text is null or empty", async () => {
      mockEncryptService.encryptString.mockResolvedValue(new EncString(""));

      await expect(
        service.encryptRiskInsightsReport({ organizationId: orgId, userId }, mockDecryptedData),
      ).rejects.toThrow("Encryption failed, encrypted strings are null");
    });

    it("should throw an error when encrypted key is null or empty", async () => {
      mockEncryptService.wrapSymmetricKey.mockResolvedValue(new EncString(""));

      await expect(
        service.encryptRiskInsightsReport({ organizationId: orgId, userId }, mockDecryptedData),
      ).rejects.toThrow("Encryption failed, encrypted strings are null");
    });

    it("should throw if org key is not found", async () => {
      mockKeyService.orgKeys$.mockReturnValue(new BehaviorSubject({}));

      await expect(
        service.encryptRiskInsightsReport({ organizationId: orgId, userId }, mockDecryptedData),
      ).rejects.toThrow("Organization key not found");
    });
  });

  describe("decryptRiskInsightsReport", () => {
    describe("V2C format (compressed)", () => {
      beforeEach(() => {
        resetDecryptionMocks();
        mockCompressionService.isCompressed.mockReturnValue(true);
      });

      it("should decrypt V2C compressed data and return original object", async () => {
        setupBasicDecryption();

        const v2cPayload = createV2CPayload();

        mockEncryptService.decryptString
          .mockResolvedValueOnce(COMPRESSED_TEXT)
          .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
          .mockResolvedValueOnce(JSON.stringify(mockApplicationData));

        mockCompressionService.decompressString.mockResolvedValue(JSON.stringify(v2cPayload));

        const result = await service.decryptRiskInsightsReport(
          { organizationId: orgId, userId },
          mockEncryptedData,
          mockKey,
        );

        expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
        expect(mockEncryptService.unwrapSymmetricKey).toHaveBeenCalledWith(mockKey, orgKey);
        expect(mockEncryptService.decryptString).toHaveBeenCalledTimes(3);
        expect(mockCompressionService.isCompressed).toHaveBeenCalledWith(COMPRESSED_TEXT);
        expect(mockCompressionService.decompressString).toHaveBeenCalledWith(COMPRESSED_TEXT);

        // Note: V2C format doesn't store cipherId in member details, so it's set to ""
        expect(result.summaryData).toEqual(mockSummaryData);
        expect(result.applicationData).toEqual(mockApplicationData);
        expect(result.reportData.length).toBe(mockReportData.length);
        expect(result.reportData[0].applicationName).toBe(mockReportData[0].applicationName);
        expect(result.reportData[0].passwordCount).toBe(mockReportData[0].passwordCount);
        expect(result.reportData[0].memberDetails[0].cipherId).toBe("");
        expect(result.reportData[0].atRiskMemberDetails[0].cipherId).toBe("");
      });
    });

    describe("V1 format (legacy)", () => {
      beforeEach(() => {
        resetDecryptionMocks();
        mockCompressionService.isCompressed.mockReturnValue(false);
      });

      it("should decrypt V1 legacy format without compression", async () => {
        setupBasicDecryption();

        mockEncryptService.decryptString
          .mockResolvedValueOnce(JSON.stringify(mockReportData))
          .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
          .mockResolvedValueOnce(JSON.stringify(mockApplicationData));

        const result = await service.decryptRiskInsightsReport(
          { organizationId: orgId, userId },
          mockEncryptedData,
          mockKey,
        );

        expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
        expect(mockEncryptService.unwrapSymmetricKey).toHaveBeenCalledWith(mockKey, orgKey);
        expect(mockEncryptService.decryptString).toHaveBeenCalledTimes(3);
        expect(mockCompressionService.isCompressed).toHaveBeenCalledWith(
          JSON.stringify(mockReportData),
        );
        expect(mockCompressionService.decompressString).not.toHaveBeenCalled();

        expect(result).toEqual({
          reportData: mockReportData,
          summaryData: mockSummaryData,
          applicationData: mockApplicationData,
        });
      });

      it("should invoke data type validation method during decryption", async () => {
        setupBasicDecryption();

        mockEncryptService.decryptString
          .mockResolvedValueOnce(JSON.stringify(mockReportData))
          .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
          .mockResolvedValueOnce(JSON.stringify(mockApplicationData));

        const result = await service.decryptRiskInsightsReport(
          { organizationId: orgId, userId },
          mockEncryptedData,
          mockKey,
        );

        expect(result).toEqual({
          reportData: mockReportData,
          summaryData: mockSummaryData,
          applicationData: mockApplicationData,
        });
      });
    });

    describe("error handling", () => {
      beforeEach(() => {
        resetDecryptionMocks();
        setupBasicDecryption();
        mockCompressionService.isCompressed.mockReturnValue(false);
      });

      it("should return null if org key is not found", async () => {
        mockKeyService.orgKeys$.mockReturnValue(new BehaviorSubject({}));

        await expect(
          service.decryptRiskInsightsReport(
            { organizationId: orgId, userId },
            mockEncryptedData,
            mockKey,
          ),
        ).rejects.toEqual(Error("Organization key not found"));
      });

      it("should throw if decrypt throws", async () => {
        mockEncryptService.unwrapSymmetricKey.mockRejectedValue(new Error("fail"));

        await expect(
          service.decryptRiskInsightsReport(
            { organizationId: orgId, userId },
            mockEncryptedData,
            mockKey,
          ),
        ).rejects.toEqual(Error("fail"));
      });

      it("should throw error when report data validation fails", async () => {
        mockEncryptService.decryptString
          .mockResolvedValueOnce(JSON.stringify([{ invalid: "data" }]))
          .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
          .mockResolvedValueOnce(JSON.stringify(mockApplicationData));

        await expect(
          service.decryptRiskInsightsReport(
            { organizationId: orgId, userId },
            mockEncryptedData,
            mockKey,
          ),
        ).rejects.toThrow(
          /Report data validation failed.*This may indicate data corruption or tampering/,
        );
      });

      it("should throw error when summary data validation fails", async () => {
        mockEncryptService.decryptString
          .mockResolvedValueOnce(JSON.stringify(mockReportData))
          .mockResolvedValueOnce(JSON.stringify({ invalid: "summary" }))
          .mockResolvedValueOnce(JSON.stringify(mockApplicationData));

        await expect(
          service.decryptRiskInsightsReport(
            { organizationId: orgId, userId },
            mockEncryptedData,
            mockKey,
          ),
        ).rejects.toThrow(
          /Summary data validation failed.*This may indicate data corruption or tampering/,
        );
      });

      it("should throw error when application data validation fails", async () => {
        mockEncryptService.decryptString
          .mockResolvedValueOnce(JSON.stringify(mockReportData))
          .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
          .mockResolvedValueOnce(JSON.stringify([{ invalid: "application" }]));

        await expect(
          service.decryptRiskInsightsReport(
            { organizationId: orgId, userId },
            mockEncryptedData,
            mockKey,
          ),
        ).rejects.toThrow(
          /Application data validation failed.*This may indicate data corruption or tampering/,
        );
      });

      it("should throw error for invalid date in application data", async () => {
        const invalidApplicationData = [
          {
            applicationName: "Test App",
            isCritical: true,
            reviewedDate: "invalid-date-string",
          },
        ];

        mockEncryptService.decryptString
          .mockResolvedValueOnce(JSON.stringify(mockReportData))
          .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
          .mockResolvedValueOnce(JSON.stringify(invalidApplicationData));

        await expect(
          service.decryptRiskInsightsReport(
            { organizationId: orgId, userId },
            mockEncryptedData,
            mockKey,
          ),
        ).rejects.toThrow(
          /Application data validation failed.*This may indicate data corruption or tampering/,
        );
      });
    });
  });
});
