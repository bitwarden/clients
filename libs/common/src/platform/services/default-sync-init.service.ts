import { Dependency, Injector } from "../abstractions/injector";
import { SyncInitializable } from "../abstractions/sync-initializable";

import { topologicalSort } from "./init-utils";

/**
 * Framework-agnostic synchronous initialization service.
 * Executes init() methods synchronously in dependency order.
 *
 * Differences from async init:
 * - No Promise handling
 * - Synchronous execution only
 * - Uses same topological sort for dependency resolution
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

    // Sort by dependencies using shared utility
    const sorted = topologicalSort(services, this.serviceTokens, (s) => s.syncDependencies);

    // Execute init() synchronously for each service
    for (const service of sorted) {
      try {
        service.init();
      } catch (error) {
        const serviceName = service.constructor?.name || "Unknown";
        throw new Error(`Failed to synchronously initialize ${serviceName}: ${error}`);
      }
    }
  }
}
