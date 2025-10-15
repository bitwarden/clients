import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { PhishingChecksumService } from "./phishing-checksum.service";
import { PhishingDataParserService } from "./phishing-data-parser.service";

export interface ICloudPhishingDomainQuery {
  getPhishingDomainsAsync(): Promise<string[]>;
  getRemoteChecksumAsync(): Promise<string>;
}

export class CDNPhishingService implements ICloudPhishingDomainQuery {
  private static readonly _DOMAINS_URL =
    "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt";
  private static readonly _CHECKSUM_SHA256_URL =
    "https://raw.githubusercontent.com/Phishing-Database/checksums/refs/heads/master/phishing-domains-ACTIVE.txt.sha256";
  private static readonly _TIMEOUT = 15000;

  constructor(
    private readonly logService: LogService,
    private readonly parserService: PhishingDataParserService,
    private readonly checksumService: PhishingChecksumService,
  ) {}

  async getPhishingDomainsAsync(): Promise<string[]> {
    try {
      this.logService.info("[CDNPhishingService] Fetching phishing domains from GitHub CDN");

      const response = await this._fetchWithTimeout(CDNPhishingService._DOMAINS_URL);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      const domains = this.parserService.parseDomains(content);

      this.logService.info(
        `[CDNPhishingService] Successfully parsed ${domains.length} domains from GitHub CDN`,
      );
      return domains;
    } catch (error) {
      this.logService.error(
        "[CDNPhishingService] Failed to fetch phishing domains from GitHub CDN:",
        error,
      );
      throw error;
    }
  }

  async getRemoteChecksumAsync(): Promise<string> {
    try {
      this.logService.info(
        "[CDNPhishingService] Fetching remote checksum (SHA-256) from GitHub checksums repo",
      );

      // Fetch the remote SHA-256 checksum
      const response = await this._fetchWithTimeout(CDNPhishingService._CHECKSUM_SHA256_URL);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      // Expected format: "<hex> *phishing-domains-ACTIVE.txt"; take the first token as checksum
      const parsed = content.trim().split(/\s+/)[0]?.trim() ?? "";

      if (!this.checksumService.validateChecksum(parsed)) {
        throw new Error("Invalid checksum format received from remote checksums repo");
      }

      this.logService.info(
        `[CDNPhishingService] Successfully retrieved remote checksum: ${parsed}`,
      );
      return parsed;
    } catch (error) {
      this.logService.error(
        "[CDNPhishingService] Failed to fetch remote checksum from GitHub:",
        error,
      );
      throw error;
    }
  }

  // Only downloading domains if checksum changes

  private async _fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CDNPhishingService._TIMEOUT);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/plain",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${CDNPhishingService._TIMEOUT}ms`);
      }
      throw error;
    }
  }
}
