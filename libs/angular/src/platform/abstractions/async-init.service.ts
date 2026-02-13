import { AsyncDependency } from "@bitwarden/common/platform/abstractions/async-initializable";
import { SafeInjectionToken } from "@bitwarden/ui-common";

import { SafeProvider } from "../utils/safe-provider";

/**
 * Multi-provider token for registering service classes that need async initialization.
 * Register the service class/token (not the instance) and Angular's Injector will resolve them.
 * Services register themselves by adding to their library's provider bundle:
 *
 * @example
 * ```typescript
 * export const VAULT_PROVIDERS = [
 *   asyncInitializableProvider(SyncService),
 *   asyncInitializableProvider(VaultTimeoutService),
 * ];
 * ```
 *
 * Note: Use useValue (not useExisting) to register the class token itself.
 */
export const ASYNC_INIT_SERVICES = new SafeInjectionToken<AsyncDependency[]>("ASYNC_INIT_SERVICES");

/**
 * Helper function to create a type-safe provider for an AsyncInitializable service.
 *
 * @param ctor The AsyncInitializable service class/token to register
 */
export function asyncInitializableProvider<T extends AsyncDependency>(ctor: T) {
  return {
    provide: ASYNC_INIT_SERVICES,
    useValue: ctor,
    multi: true,
  } as SafeProvider;
}

/**
 * Service responsible for coordinating async initialization.
 * Discovers all registered AsyncInitializable services and executes their init()
 * methods in dependency order using topological sort.
 */
export abstract class AsyncInitService {
  /**
   * Initialize all registered services in dependency order.
   * Throws an error if circular dependencies are detected.
   */
  abstract init(): Promise<void>;
}
