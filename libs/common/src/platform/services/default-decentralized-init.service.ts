import { Dependency, Initializable } from "../abstractions/initializable";
import { Injector } from "../abstractions/injector";

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

    const sorted = this.topologicalSort(services, this.serviceTokens);

    for (const service of sorted) {
      try {
        await service.init();
      } catch (error) {
        const serviceName = service.constructor?.name || "Unknown";
        throw new Error(`Failed to initialize ${serviceName}: ${error}`);
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
        const serviceName = service.constructor?.name || "Unknown";
        const cycle = [...path, serviceName].join(" -> ");
        throw new Error(`Circular dependency detected: ${cycle}`);
      }

      visiting.add(service);
      const serviceName = service.constructor?.name || "Unknown";
      const currentPath = [...path, serviceName];

      // Visit all dependencies first
      for (const depClass of service.dependencies ?? []) {
        const depInstance = instanceMap.get(depClass);

        if (!depInstance) {
          // Dependency declared but not registered - this is likely a configuration error
          const depName = depClass.name || "Unknown";
          throw new Error(
            `${serviceName} depends on ${depName}, but ${depName} is not registered. ` +
              `Make sure to register it in your initialization service tokens:\n` +
              `Angular: { provide: INIT_SERVICES, useValue: ${depName}, multi: true }\n` +
              `Background: Add ${depName} to initServiceTokens array and register with injector`,
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
