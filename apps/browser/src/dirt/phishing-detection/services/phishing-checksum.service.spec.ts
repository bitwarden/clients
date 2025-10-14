import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";

import { PhishingChecksumService } from "./phishing-checksum.service";

describe("PhishingChecksumService", () => {
  let service: PhishingChecksumService;
  let logService: LogService;
  let storageService: AbstractStorageService;

  beforeEach(() => {
    logService = {
      debug: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    } as any;

    storageService = {
      get: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    } as any;

    service = new PhishingChecksumService(logService, storageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validateChecksum", () => {
    it("should validate correct SHA256 checksum format", () => {
      const validChecksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      expect(service.validateChecksum(validChecksum)).toBe(true);
    });

    it("should validate uppercase SHA256 checksum format", () => {
      const validChecksum = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";

      expect(service.validateChecksum(validChecksum)).toBe(true);
    });

    it("should reject invalid checksum formats", () => {
      const invalidChecksums = [
        "", // empty
        "   ", // whitespace only
        "short", // too short
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefextra", // too long
        "g1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890", // invalid characters
      ];

      invalidChecksums.forEach((checksum) => {
        expect(service.validateChecksum(checksum)).toBe(false);
      });
    });

    it("should handle null and undefined", () => {
      expect(service.validateChecksum(null as any)).toBe(false);
      expect(service.validateChecksum(undefined as any)).toBe(false);
    });

    it("should trim whitespace before validation", () => {
      const validChecksum = "  0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  ";

      expect(service.validateChecksum(validChecksum)).toBe(true);
    });
  });

  describe("getCurrentChecksum", () => {
    it("should retrieve checksum from storage", async () => {
      const storedChecksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      (storageService.get as jest.Mock).mockResolvedValue(storedChecksum);

      const result = await service.getCurrentChecksum();

      expect(storageService.get).toHaveBeenCalledWith("phishing_domains_checksum");
      expect(result).toBe(storedChecksum);
    });

    it("should return empty string when no checksum is stored", async () => {
      (storageService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.getCurrentChecksum();

      expect(result).toBe("");
    });

    it("should handle storage errors gracefully", async () => {
      const storageError = new Error("Storage error");
      (storageService.get as jest.Mock).mockRejectedValue(storageError);

      const result = await service.getCurrentChecksum();

      expect(result).toBe("");
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingChecksumService] Failed to get current checksum:",
        storageError,
      );
    });
  });

  describe("saveChecksum", () => {
    it("should save valid checksum to storage", async () => {
      const validChecksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      (storageService.save as jest.Mock).mockResolvedValue(undefined);

      await service.saveChecksum(validChecksum);

      expect(storageService.save).toHaveBeenCalledWith("phishing_domains_checksum", validChecksum);
      expect(logService.debug).toHaveBeenCalledWith(
        "[PhishingChecksumService] Saved checksum: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      );
    });

    it("should not save invalid checksum", async () => {
      const invalidChecksum = "invalid";
      (storageService.save as jest.Mock).mockResolvedValue(undefined);

      await service.saveChecksum(invalidChecksum);

      expect(storageService.save).not.toHaveBeenCalled();
      expect(logService.warning).toHaveBeenCalledWith(
        "[PhishingChecksumService] Invalid checksum format: invalid",
      );
    });

    it("should handle storage errors", async () => {
      const validChecksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const storageError = new Error("Storage error");
      (storageService.save as jest.Mock).mockRejectedValue(storageError);

      await expect(service.saveChecksum(validChecksum)).rejects.toThrow("Storage error");
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingChecksumService] Failed to save checksum:",
        storageError,
      );
    });
  });

  describe("compareChecksums", () => {
    it("should return true for identical checksums", () => {
      const checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      expect(service.compareChecksums(checksum, checksum)).toBe(true);
    });

    it("should return false for different checksums", () => {
      const checksum1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const checksum2 = "b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890a1";

      expect(service.compareChecksums(checksum1, checksum2)).toBe(false);
    });

    it("should handle case insensitive comparison", () => {
      const checksum1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const checksum2 = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";

      expect(service.compareChecksums(checksum1, checksum2)).toBe(true);
    });

    it("should handle whitespace trimming", () => {
      const checksum1 = "  0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  ";
      const checksum2 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      expect(service.compareChecksums(checksum1, checksum2)).toBe(true);
    });

    it("should handle null and undefined values", () => {
      const checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      expect(service.compareChecksums(null as any, checksum)).toBe(false);
      expect(service.compareChecksums(checksum, null as any)).toBe(false);
      expect(service.compareChecksums(null as any, null as any)).toBe(true);
      expect(service.compareChecksums(undefined as any, checksum)).toBe(false);
      expect(service.compareChecksums(checksum, undefined as any)).toBe(false);
    });

    it("should log comparison results", () => {
      const checksum1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const checksum2 = "b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890a1";

      service.compareChecksums(checksum1, checksum2);

      expect(logService.debug).toHaveBeenCalledWith(
        "[PhishingChecksumService] Checksum comparison: different",
      );
    });
  });
});
