import { SyncDependency } from "@bitwarden/common/platform/abstractions/sync-initializable";

import { SafeInjectionToken } from "../utils/safe-injection-token";
import { SafeProvider } from "../utils/safe-provider";

/**
 * Multi-provider token for registering services that need synchronous initialization.
 */
export const SYNC_INIT_SERVICES = new SafeInjectionToken<SyncDependency[]>("SYNC_INIT_SERVICES");

/**
 * Helper function to create a type-safe provider for a SyncInitializable service.
 */
export function syncInitializableProvider<T extends SyncDependency>(ctor: T) {
  return {
    provide: SYNC_INIT_SERVICES,
    useValue: ctor,
    multi: true,
  } as SafeProvider;
}

/**
 * Service responsible for coordinating synchronous initialization.
 * Executes init() methods synchronously in registration order.
 */
export abstract class SyncInitService {
  /**
   * Initialize all registered services synchronously in registration order.
   * Throws an error if any service fails to initialize.
   */
  abstract init(): void;
}
