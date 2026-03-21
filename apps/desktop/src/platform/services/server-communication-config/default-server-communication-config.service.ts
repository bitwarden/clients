import { firstValueFrom, Observable, shareReplay, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { FetchMiddleware, FetchFn } from "@bitwarden/common/platform/misc/fetch-middleware";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ServerCommunicationConfigClient } from "@bitwarden/sdk-internal";

import { ServerCommunicationConfigPlatformApiService } from "./server-communication-config-platform-api.service";
import { ServerCommunicationConfigRepository } from "./server-communication-config.repository";
import { ServerCommunicationConfigService } from "./server-communication-config.service";

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
    protected platformApi: ServerCommunicationConfigPlatformApiService,
    private configService: ConfigService,
    private apiService: ApiService,
  ) {}

  async init() {
    this.platformApi.init();

    // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
    await SdkLoadService.Ready;
    // Initialize SDK client with repository and platform API
    this.client = new ServerCommunicationConfigClient(this.repository, this.platformApi);
    // Forward each server communication config update to the SDK client
    this.configService.serverCommunicationConfig$.subscribe((config) => {
      if (config.bootstrap.type === "direct") {
        return;
      }

      // FIXME The requirement on a hostname will be removed in the sdk, but the bindings need to be updated. Andreas is working on this.
      void this.client.setCommunicationType(config.bootstrap.cookieDomain!, config);
    });
    this.apiService.addMiddleware(this.buildRedirectMiddleware());
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

  async acquireCookie(url: string): Promise<void> {
    // SDK client handles:
    // 1. Calling platform API (this.platformApi.acquireCookies(url))
    // 2. Validating cookie names match config
    // 3. Saving validated cookies to repository
    // 4. Throwing appropriate AcquireCookieError on failure
    await this.client.acquireCookie(url);

    // Small delay to ensure cookies are saved before retrying request
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private buildRedirectMiddleware(): FetchMiddleware {
    return async (request: Request, next: FetchFn): Promise<Response> => {
      const manualRequest = new Request(request.clone(), { redirect: "manual" });
      const response = await next(manualRequest);

      if (response.type !== "opaqueredirect") {
        return response;
      }

      const hostname = Utils.getHostname(request.url);
      if (Utils.isNullOrWhitespace(hostname)) {
        return response;
      }
      const needsBootstrap = await firstValueFrom(this.needsBootstrap$(hostname));
      if (!needsBootstrap) {
        return response;
      }

      await this.acquireCookie(hostname);
      // Retry with original request (follow redirect mode, cookies now in session)
      return next(request);
    };
  }
}
