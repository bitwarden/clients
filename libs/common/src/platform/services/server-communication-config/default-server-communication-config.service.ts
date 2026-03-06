import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  ServerCommunicationConfigClient,
  ServerCommunicationConfigPlatformApi,
} from "@bitwarden/sdk-internal";

import { ConfigService } from "../../abstractions/config/config.service";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import { ServerCommunicationConfigService } from "../../abstractions/server-communication-config/server-communication-config.service";
import { Utils } from "../../misc/utils";

import { ServerCommunicationConfigRepository } from "./server-communication-config.repository";

/**
 * Default implementation of {@link ServerCommunicationConfigService}.
 *
 * Bridges the Angular config pipeline with the SDK's {@link ServerCommunicationConfigClient}.
 * On {@link init}, it:
 * 1. Waits for the SDK to be ready.
 * 2. Creates a {@link ServerCommunicationConfigClient} using the provided repository and platform API.
 * 3. Subscribes to {@link ConfigService.serverCommunicationConfig$} and, for each non-direct
 *    bootstrap config, calls `setCommunicationType` on the client and registers an API middleware
 *    that injects any SDK-managed cookies into outgoing requests (used for SSO authentication).
 */
export class DefaultServerCommunicationConfigService implements ServerCommunicationConfigService {
  /** SDK client responsible for managing server communication configuration and cookie state. */
  private client!: ServerCommunicationConfigClient;

  constructor(
    protected repository: ServerCommunicationConfigRepository,
    protected platformApi: ServerCommunicationConfigPlatformApi,
    private configService: ConfigService,
    private apiService: ApiService,
  ) {}

  /**
   * Initializes the service.
   *
   * Must be called once at application startup. Waits for the SDK to load, then wires up
   * config change subscriptions and API middleware for cookie injection.
   */
  async init() {
    // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
    await SdkLoadService.Ready;
    // Initialize SDK client with repository and platform API
    this.client = new ServerCommunicationConfigClient(this.repository, this.platformApi);
    // Forward each server communication config update to the SDK client
    this.configService.serverCommunicationConfig$.subscribe((config) => {
      if (config.bootstrap.type === "direct") {
        return;
      }

      //Will break the build until the sdk-method signature is updated (WIP)
      void this.client.setCommunicationType(config);

      // Set up middleware to add cookies to API requests for SSO authentication
      const cookieMiddleware = async (request: Request): Promise<void> => {
        const domain = Utils.getDomain(request.url);
        const cookies: [string, string][] = await this.client.cookies(domain);

        if (cookies.length > 0) {
          const cookieHeader = cookies.map(([name, value]) => `${name}=${value}`).join("; ");
          request.headers.set("Cookie", cookieHeader);
        }
      };

      this.apiService.addMiddleware(cookieMiddleware);
    });
  }
}
