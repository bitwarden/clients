import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";

export class PhishingChecksumService {
  private static readonly _CHECKSUM_STORAGE_KEY = "phishing_domains_checksum";

  constructor(
    private readonly logService: LogService,
    private readonly storageService: AbstractStorageService,
  ) {}

  /**
   * Validates checksum format (SHA256 hex string)
   */
  validateChecksum(checksum: string): boolean {
    if (!checksum || checksum.trim() === "") {
      return false;
    }

    // SHA256 produces 64-character hex string
    const sha256Regex = /^[a-fA-F0-9]{64}$/i;
    return sha256Regex.test(checksum.trim());
  }

  /**
   * Gets the current checksum from storage
   */
  async getCurrentChecksum(): Promise<string> {
    try {
      const checksum = await this.storageService.get<string>(
        PhishingChecksumService._CHECKSUM_STORAGE_KEY,
      );
      return checksum || "";
    } catch (error) {
      this.logService.error("[PhishingChecksumService] Failed to get current checksum:", error);
      return "";
    }
  }

  /**
   * Saves checksum to storage
   */
  async saveChecksum(checksum: string): Promise<void> {
    if (!this.validateChecksum(checksum)) {
      this.logService.warning(`[PhishingChecksumService] Invalid checksum format: ${checksum}`);
      return;
    }

    try {
      await this.storageService.save(PhishingChecksumService._CHECKSUM_STORAGE_KEY, checksum);
      this.logService.debug(`[PhishingChecksumService] Saved checksum: ${checksum}`);
    } catch (error) {
      this.logService.error("[PhishingChecksumService] Failed to save checksum:", error);
      throw error;
    }
  }

  /**
   * Compares two checksums
   */
  compareChecksums(current: string, remote: string): boolean {
    const normalizedCurrent = current?.trim().toLowerCase() || "";
    const normalizedRemote = remote?.trim().toLowerCase() || "";

    const isEqual = normalizedCurrent === normalizedRemote;
    this.logService.debug(
      `[PhishingChecksumService] Checksum comparison: ${isEqual ? "equal" : "different"}`,
    );

    return isEqual;
  }
}
