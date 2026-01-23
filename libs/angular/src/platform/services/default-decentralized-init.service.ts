import { Inject, Injectable, Injector } from "@angular/core";

import { Dependency, Initializable } from "@bitwarden/common/platform/abstractions/initializable";

import {
  DecentralizedInitService,
  INIT_SERVICES,
} from "../abstractions/decentralized-init.service";

/**
 * Default implementation of DecentralizedInitService that uses topological sort
 * to execute initialization in dependency order.
 *
 * This service:
 * - Collects registered service tokens via the INIT_SERVICES token
 * - Resolves tokens to instances using Angular's Injector
 * - Builds a dependency graph from each service's dependencies property
 * - Performs topological sort to determine execution order
 * - Detects circular dependencies and throws clear errors
 * - Executes init() methods sequentially in dependency order
 */
@Injectable()
export class DefaultDecentralizedInitService implements DecentralizedInitService {
  constructor(
    @Inject(INIT_SERVICES) private initServiceTokens: Dependency[],
    private injector: Injector,
  ) {}

  async init(): Promise<void> {
    if (!this.initServiceTokens || this.initServiceTokens.length === 0) {
      return;
    }

    // Resolve all tokens to instances using Angular's Injector
    const services: Initializable[] = this.initServiceTokens.map((token) =>
      this.injector.get(token),
    );

    const sorted = this.topologicalSort(services, this.initServiceTokens);

    for (const service of sorted) {
      try {
        await service.init();
      } catch (error) {
        throw new Error(`Failed to initialize ${service.constructor.name}: ${error}`);
      }
    }
  }

  /**
   * Performs topological sort on services based on their declared dependencies.
   * Returns services in an order where all dependencies come before dependents.
   *
   * @param services The resolved service instances
   * @param tokens The tokens used to register these services (parallel array)
   * @throws Error if circular dependencies are detected
   * @throws Error if a dependency is declared but not registered
   */
  private topologicalSort(services: Initializable[], tokens: Dependency[]): Initializable[] {
    // Build a map from token to instance
    // This uses the exact tokens that were registered, so abstract classes work correctly
    const instanceMap = new Map<Dependency, Initializable>();
    for (let i = 0; i < services.length; i++) {
      instanceMap.set(tokens[i], services[i]);
    }

    const sorted: Initializable[] = [];
    const visiting = new Set<Initializable>();
    const visited = new Set<Initializable>();

    const visit = (service: Initializable, path: string[] = []) => {
      if (visited.has(service)) {
        return;
      }

      if (visiting.has(service)) {
        // Circular dependency detected - build a clear error message
        const cycle = [...path, service.constructor.name].join(" -> ");
        throw new Error(`Circular dependency detected: ${cycle}`);
      }

      visiting.add(service);
      const currentPath = [...path, service.constructor.name];

      // Visit all dependencies first
      for (const depClass of service.dependencies ?? []) {
        const depInstance = instanceMap.get(depClass);

        if (!depInstance) {
          // Dependency declared but not registered - this is likely a configuration error
          throw new Error(
            `${service.constructor.name} depends on ${depClass.name}, but ${depClass.name} is not registered in INIT_SERVICES. ` +
              `Make sure to add it to your providers array:\n` +
              `{ provide: INIT_SERVICES, useValue: ${depClass.name}, multi: true }`,
          );
        }

        visit(depInstance, currentPath);
      }

      visiting.delete(service);
      visited.add(service);
      sorted.push(service);
    };

    // Visit all services (handles disconnected components in the graph)
    for (const service of services) {
      visit(service);
    }

    return sorted;
  }
}
