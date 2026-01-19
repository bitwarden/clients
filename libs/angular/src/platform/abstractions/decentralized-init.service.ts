import { InjectionToken, Type } from "@angular/core";

/**
 * Services that implement Initializable can participate in decentralized initialization.
 * Each service declares its dependencies, and the DecentralizedInitService will execute
 * them in the correct order using topological sort.
 */
export abstract class Initializable {
  /**
   * List of service classes that must be initialized before this service.
   * Use actual class references for type safety and refactoring support.
   */
  abstract dependencies: Type<Initializable>[];

  /**
   * Initialize this service. Called after all dependencies have been initialized.
   * Can be async or sync.
   */
  abstract init(): Promise<void> | void;
}

/**
 * Multi-provider token for registering services that need initialization.
 * Services register themselves by adding to their library's provider bundle:
 *
 * @example
 * ```typescript
 * export const VAULT_PROVIDERS = [
 *   { provide: INIT_SERVICES, useExisting: SyncService, multi: true },
 *   { provide: INIT_SERVICES, useExisting: VaultTimeoutService, multi: true },
 * ];
 * ```
 */
export const INIT_SERVICES = new InjectionToken<Initializable[]>("INIT_SERVICES");

/**
 * Service responsible for coordinating decentralized initialization.
 * Discovers all registered Initializable services and executes their init()
 * methods in dependency order using topological sort.
 */
export abstract class DecentralizedInitService {
  /**
   * Initialize all registered services in dependency order.
   * Throws an error if circular dependencies are detected.
   */
  abstract init(): Promise<void>;
}
