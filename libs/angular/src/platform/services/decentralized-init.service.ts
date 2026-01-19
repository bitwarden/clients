import { Inject, Injectable, Type } from "@angular/core";

import {
  DecentralizedInitService as DecentralizedInitServiceAbstraction,
  Initializable,
  INIT_SERVICES,
} from "../abstractions/decentralized-init.service";

/**
 * Default implementation of DecentralizedInitService that uses topological sort
 * to execute initialization in dependency order.
 *
 * This service:
 * - Discovers all registered Initializable services via the INIT_SERVICES token
 * - Builds a dependency graph from each service's dependencies property
 * - Performs topological sort to determine execution order
 * - Detects circular dependencies and throws clear errors
 * - Executes init() methods sequentially in dependency order
 */
@Injectable()
export class DecentralizedInitService implements DecentralizedInitServiceAbstraction {
  constructor(@Inject(INIT_SERVICES) private initServices: Initializable[]) {}

  async init(): Promise<void> {
    if (!this.initServices || this.initServices.length === 0) {
      return;
    }

    const sorted = this.topologicalSort(this.initServices);

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
   * @throws Error if circular dependencies are detected
   * @throws Error if a dependency is declared but not registered
   */
  private topologicalSort(services: Initializable[]): Initializable[] {
    // Build a map from constructor to instance for quick lookup
    const instanceMap = new Map<Type<Initializable>, Initializable>();
    for (const service of services) {
      instanceMap.set(service.constructor as Type<Initializable>, service);
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
      for (const depClass of service.dependencies) {
        const depInstance = instanceMap.get(depClass);

        if (!depInstance) {
          // Dependency declared but not registered - this is likely a configuration error
          throw new Error(
            `${service.constructor.name} depends on ${depClass.name}, but ${depClass.name} is not registered in INIT_SERVICES. ` +
              `Make sure to add it to your providers array:\n` +
              `{ provide: INIT_SERVICES, useExisting: ${depClass.name}, multi: true }`,
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
