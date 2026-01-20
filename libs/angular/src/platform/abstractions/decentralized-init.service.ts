import { InjectionToken } from "@angular/core";

import { Dependency, Initializable } from "@bitwarden/common/platform/abstractions/initializable";

import { SafeProvider } from "../utils/safe-provider";

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
 * Helper function to create a type-safe provider for an Initializable service.
 *
 * @param type The Initializable service class
 */
export function initializableProvider<T extends Dependency>(ctor: T) {
  return {
    provide: INIT_SERVICES,
    useExisting: ctor,
    multi: true,
  } as SafeProvider;
}

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
