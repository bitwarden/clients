/**
 * Example usage of DefaultDecentralizedInitService
 *
 * This file demonstrates how to:
 * 1. Make services implement Initializable
 * 2. Register services with INIT_SERVICES
 * 3. Use DefaultDecentralizedInitService in your app
 *
 * This is NOT production code - it's a reference example.
 */

import { Injectable } from "@angular/core";

import { Initializable, Dependency } from "@bitwarden/common/platform/abstractions/initializable";

import { INIT_SERVICES } from "../abstractions/decentralized-init.service";

// ============================================================================
// STEP 1: Make your services implement Initializable
// ============================================================================

/**
 * Example: Service with no dependencies
 * This will run first (or in parallel with other no-dependency services)
 */
@Injectable({ providedIn: "root" })
export class ExampleConfigService implements Initializable {
  dependencies: Dependency[] = []; // No dependencies

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
export class ExampleDatabaseService implements Initializable {
  dependencies = [ExampleConfigService]; // Type-safe class reference

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
export class ExampleSyncService implements Initializable {
  dependencies = [ExampleConfigService, ExampleDatabaseService];

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
// STEP 2: Register services in your library's provider bundle
// ============================================================================

/**
 * Each library exports a provider array that apps can import.
 * Services with providedIn: 'root' don't need to be in the array,
 * but the INIT_SERVICES registration IS required to prevent tree-shaking.
 */
export const EXAMPLE_LIBRARY_PROVIDERS = [
  // The multi-provider registration prevents tree-shaking
  // while providedIn: 'root' handles the actual service instantiation
  { provide: INIT_SERVICES, useValue: ExampleConfigService, multi: true },
  { provide: INIT_SERVICES, useValue: ExampleDatabaseService, multi: true },
  { provide: INIT_SERVICES, useValue: ExampleSyncService, multi: true },
];

// ============================================================================
// STEP 3: Use in your app config
// ============================================================================

/**
 * In your app's main config (e.g., app.config.ts or main.ts):
 *
 * import { DefaultDecentralizedInitService } from '@bitwarden/angular/platform/services/default-decentralized-init.service';
 * import { EXAMPLE_LIBRARY_PROVIDERS } from '@bitwarden/angular/platform/services/decentralized-init.service.example';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     ...EXAMPLE_LIBRARY_PROVIDERS,
 *     DefaultDecentralizedInitService,
 *     {
 *       provide: APP_INITIALIZER,
 *       useFactory: (initService: DefaultDecentralizedInitService) => () => initService.init(),
 *       deps: [DefaultDecentralizedInitService],
 *       multi: true,
 *     },
 *   ]
 * };
 *
 * Or in your root component:
 *
 * @Component({ ... })
 * export class AppComponent {
 *   constructor(private initService: DefaultDecentralizedInitService) {}
 *
 *   ngOnInit() {
 *     await this.initService.init();
 *   }
 * }
 */

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
 *  { provide: INIT_SERVICES, useValue: ServiceB, multi: true }"
 */
