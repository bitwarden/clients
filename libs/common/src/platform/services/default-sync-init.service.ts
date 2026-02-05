import { Dependency } from "../abstractions/initializable";
import { Injector } from "../abstractions/injector";
import { SyncInitializable } from "../abstractions/sync-initializable";

/**
 * Framework-agnostic synchronous initialization service.
 * Executes init() methods synchronously in registration order.
 *
 * Differences from async init:
 * - No dependency graph / topological sort
 * - No Promise handling
 * - Order is determined by registration order
 * - Errors halt initialization immediately
 */
export class DefaultSyncInitService {
  constructor(
    private readonly serviceTokens: Dependency[],
    private readonly injector: Injector,
  ) {}

  init(): void {
    if (!this.serviceTokens || this.serviceTokens.length === 0) {
      return;
    }

    // Resolve all tokens to instances
    const services: SyncInitializable[] = this.serviceTokens.map((token) =>
      this.injector.get(token),
    );

    // Execute init() synchronously for each service
    for (const service of services) {
      try {
        service.init();
      } catch (error) {
        const serviceName = service.constructor?.name || "Unknown";
        throw new Error(`Failed to synchronously initialize ${serviceName}: ${error}`);
      }
    }
  }
}
