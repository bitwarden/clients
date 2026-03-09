import { AcquiredCookie, ServerCommunicationConfigPlatformApi } from "@bitwarden/sdk-internal";

/**
 * Noop implementation for SSO cookie acquisition.
 *
 * Temporary implementation, will be replaced after https://github.com/bitwarden/clients/pull/18837 merges
 */
export class NoopServerCommunicationConfigPlatformApiService implements ServerCommunicationConfigPlatformApi {
  constructor() {}

  async acquireCookies(hostname: string): Promise<AcquiredCookie[] | undefined> {
    return;
  }
}
