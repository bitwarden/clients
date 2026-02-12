import { Dependency, Initializable } from "../abstractions/initializable";
import { Injector } from "../abstractions/injector";

import { topologicalSort } from "./init-utils";

/**
 * Framework-agnostic implementation of decentralized initialization service.
 * Uses topological sort to execute initialization in dependency order.
 *
 * This service:
 * - Accepts service tokens directly (no DI-specific decorators)
 * - Resolves tokens to instances using the provided Injector abstraction
 * - Builds a dependency graph from each service's dependencies property
 * - Performs topological sort to determine execution order
 * - Detects circular dependencies and throws clear errors
 * - Executes init() methods sequentially in dependency order
 *
 * Works in both Angular (via AngularInjectorAdapter) and non-Angular contexts
 * (via BackgroundInjector or any Injector implementation).
 */
export class DefaultDecentralizedInitService {
  constructor(
    private readonly serviceTokens: Dependency[],
    private readonly injector: Injector,
  ) {}

  async init(): Promise<void> {
    if (!this.serviceTokens || this.serviceTokens.length === 0) {
      return;
    }

    // Resolve all tokens to instances using the provided Injector
    const services: Initializable[] = this.serviceTokens.map((token) => this.injector.get(token));

    // Use shared topological sort utility
    const sorted = topologicalSort(services, this.serviceTokens);

    for (const service of sorted) {
      try {
        await service.init();
      } catch (error) {
        const serviceName = service.constructor?.name || "Unknown";
        throw new Error(`Failed to initialize ${serviceName}: ${error}`);
      }
    }
  }
}
