/**
 * Example usage of DefaultDecentralizedInitService
 *
 * This file demonstrates how to:
 * 1. Make services implement AsyncInitializable
 * 2. Register services using initializableProvider()
 * 3. Bootstrap DecentralizedInitService in your app module
 *
 * This is NOT production code - it's a reference example.
 */

import { inject, Injectable, provideAppInitializer } from "@angular/core";

import {
  AsyncInitializable,
  AsyncDependency,
} from "@bitwarden/common/platform/abstractions/initializable";

import {
  DecentralizedInitService,
  initializableProvider,
} from "../abstractions/decentralized-init.service";

// ============================================================================
// STEP 1: Make your services implement AsyncInitializable
// ============================================================================

/**
 * Example: Service with no dependencies
 * This will run first (or in parallel with other no-dependency services)
 */
@Injectable({ providedIn: "root" })
export class ExampleConfigService implements AsyncInitializable {
  asyncDependencies: AsyncDependency[] = []; // No dependencies

  async init(): Promise<void> {
    // Load config, etc.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Example: Service that depends on ConfigService
 * This will run AFTER ConfigService
 */
@Injectable({ providedIn: "root" })
export class ExampleDatabaseService implements AsyncInitializable {
  asyncDependencies = [ExampleConfigService]; // Type-safe class reference

  constructor(private configService: ExampleConfigService) {}

  async init(): Promise<void> {
    // ConfigService is guaranteed to be initialized already
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Example: Service with multiple dependencies
 * This will run AFTER both ConfigService and DatabaseService
 */
@Injectable({ providedIn: "root" })
export class ExampleSyncService implements AsyncInitializable {
  asyncDependencies = [ExampleConfigService, ExampleDatabaseService];

  constructor(
    private configService: ExampleConfigService,
    private databaseService: ExampleDatabaseService,
  ) {}

  async init(): Promise<void> {
    // Both dependencies are guaranteed to be initialized
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// ============================================================================
// STEP 2: Register services in your app's providers array
// ============================================================================

/**
 * Use initializableProvider() to register each AsyncInitializable service.
 * This creates a type-safe multi-provider entry for INIT_SERVICES,
 * which prevents tree-shaking while providedIn: 'root' handles instantiation.
 *
 * Then use provideAppInitializer() to bootstrap DecentralizedInitService,
 * which discovers all registered services and runs their init() methods
 * in dependency order.
 *
 * Example providers array (e.g., in a services module or app config):
 *
 * ```typescript
 * const safeProviders: SafeProvider[] = [
 *   // Bootstrap DecentralizedInitService on app startup
 *   safeProvider(
 *     provideAppInitializer(() => {
 *       const initService = inject(DecentralizedInitService);
 *       return initService.init();
 *     }),
 *   ),
 *
 *   // Register each AsyncInitializable service
 *   initializableProvider(ExampleConfigService),
 *   initializableProvider(ExampleDatabaseService),
 *   initializableProvider(ExampleSyncService),
 * ];
 * ```
 */
export const EXAMPLE_PROVIDERS = [
  provideAppInitializer(() => {
    const initService = inject(DecentralizedInitService);
    return initService.init();
  }),
  initializableProvider(ExampleConfigService),
  initializableProvider(ExampleDatabaseService),
  initializableProvider(ExampleSyncService),
];

// ============================================================================
// EXECUTION ORDER
// ============================================================================

/**
 * Based on the dependency graph above, the execution order will be:
 *
 * 1. ExampleConfigService (no dependencies)
 * 2. ExampleDatabaseService (depends on ConfigService)
 * 3. ExampleSyncService (depends on ConfigService + DatabaseService)
 *
 * The topological sort automatically determines this order at runtime.
 */

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Circular dependency detection:
 *
 * If you have services like:
 * - ServiceA depends on ServiceB
 * - ServiceB depends on ServiceA
 *
 * You'll get a clear error:
 * "Circular dependency detected: ServiceA -> ServiceB -> ServiceA"
 *
 * Missing dependency detection:
 *
 * If a service declares a dependency that isn't registered:
 * "ServiceA depends on ServiceB, but ServiceB is not registered in INIT_SERVICES.
 *  Make sure to add it to your providers array:
 *  initializableProvider(ServiceB)"
 */
