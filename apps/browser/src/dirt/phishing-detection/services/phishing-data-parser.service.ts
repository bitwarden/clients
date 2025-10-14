import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

export class PhishingDataParserService {
  constructor(private readonly logService: LogService) {}

  parseDomains(content: string): string[] {
    if (!content || content.trim() === "") {
      this.logService.debug("[PhishingDataParserService] Empty content provided");
      return [];
    }

    try {
      const domains = content
        .split(/\r?\n/) // Split by \r\n or \n
        .map((line) => line.trim()) // Trim whitespace
        .filter((line) => line && !line.startsWith("#")); // Filter empty lines and comments

      this.logService.debug(
        `[PhishingDataParserService] Parsed ${domains.length} domains from content`,
      );
      return domains;
    } catch (error) {
      this.logService.error("[PhishingDataParserService] Failed to parse domains:", error);
      return [];
    }
  }

  /**
   * Validates domain format (basic validation)
   */
  validateDomain(domain: string): boolean {
    if (!domain || domain.trim() === "") {
      return false;
    }

    // Domain validation - must contain at least one dot and valid characters
    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return domainRegex.test(domain);
  }

  /**
   * Validates and filters domains array
   */
  validateAndFilterDomains(domains: string[]): string[] {
    const validDomains = domains.filter((domain) => this.validateDomain(domain));

    if (validDomains.length !== domains.length) {
      const invalidCount = domains.length - validDomains.length;
      this.logService.warning(
        `[PhishingDataParserService] Filtered out ${invalidCount} invalid domains`,
      );
    }

    return validDomains;
  }
}
