import { InjectionToken } from "@angular/core";

import { Dependency } from "@bitwarden/common/platform/abstractions/initializable";

import { SafeProvider } from "../utils/safe-provider";

/**
 * Multi-provider token for registering service classes that need initialization.
 * Register the service class/token (not the instance) and Angular's Injector will resolve them.
 * Services register themselves by adding to their library's provider bundle:
 *
 * @example
 * ```typescript
 * export const VAULT_PROVIDERS = [
 *   { provide: INIT_SERVICES, useValue: SyncService, multi: true },
 *   { provide: INIT_SERVICES, useValue: VaultTimeoutService, multi: true },
 * ];
 * ```
 *
 * Note: Use useValue (not useExisting) to register the class token itself.
 */
export const INIT_SERVICES = new InjectionToken<Dependency[]>("INIT_SERVICES");

/**
 * Helper function to create a type-safe provider for an Initializable service.
 *
 * @param ctor The Initializable service class/token to register
 */
export function initializableProvider<T extends Dependency>(ctor: T) {
  return {
    provide: INIT_SERVICES,
    useValue: ctor,
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
