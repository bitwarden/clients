import { Observable, shareReplay, switchMap } from "rxjs";

import {
  ServerCommunicationConfigClient,
  ServerCommunicationConfigPlatformApi,
} from "@bitwarden/sdk-internal";

import { ConfigService } from "../../abstractions/config/config.service";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import { ServerCommunicationConfigService } from "../../abstractions/server-communication-config/server-communication-config.service";

import { ServerCommunicationConfigRepository } from "./server-communication-config.repository";

/**
 * Default implementation of ServerCommunicationConfigService.
 *
 * Manages server communication configuration and bootstrap detection for different
 * server environments. Provides reactive observables that automatically respond to
 * configuration changes and integrate with the SDK's ServerCommunicationConfigClient.
 *
 * @remarks
 * Bootstrap detection determines if SSO cookie acquisition is required before
 * API calls can succeed. The service watches for configuration changes and
 * re-evaluates bootstrap requirements automatically.
 *
 * Key features:
 * - Reactive observables for bootstrap status (`needsBootstrap$`)
 * - Per-hostname configuration management
 * - Automatic re-evaluation when config state changes
 * - Cookie retrieval for HTTP request headers
 *
 */
export class DefaultServerCommunicationConfigService implements ServerCommunicationConfigService {
  private client!: ServerCommunicationConfigClient;

  constructor(
    protected repository: ServerCommunicationConfigRepository,
    protected platformApi: ServerCommunicationConfigPlatformApi,
    private configService: ConfigService,
  ) {}

  async init() {
    // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
    await SdkLoadService.Ready;
    // Initialize SDK client with repository and platform API
    this.client = new ServerCommunicationConfigClient(this.repository, this.platformApi);
    // Forward each server communication config update to the SDK client
    this.configService.serverCommunicationConfig$.subscribe(({ hostname, config }) => {
      void this.client.setCommunicationType(hostname, config);
    });
  }

  needsBootstrap$(hostname: string): Observable<boolean> {
    // Watch hostname-specific config changes and re-check when it updates
    return this.repository.get$(hostname).pipe(
      switchMap(() => this.client.needsBootstrap(hostname)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  async getCookies(hostname: string): Promise<Array<[string, string]>> {
    return this.client.cookies(hostname);
  }
}
