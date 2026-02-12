declare const AsyncDependency: FunctionConstructor;
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export interface AsyncDependency extends Function {
  prototype: AsyncInitializable;
}

/**
 * Services that implement AsyncInitializable can participate in decentralized initialization.
 * Each service declares its dependencies, and initialization will execute them in the
 * correct order using topological sort.
 *
 * This is a framework-agnostic abstraction that can be used across all clients.
 */
export interface AsyncInitializable {
  /**
   * List of service classes that must be initialized before this service.
   * Use actual class references for type safety and refactoring support.
   *
   * Note: The exact type depends on the framework. For Angular, use Type<AsyncInitializable>.
   * For non-Angular clients, use the constructor type directly.
   */
  asyncDependencies?: AsyncDependency[];

  /**
   * Initialize this service. Called after all dependencies have been initialized.
   * Can be async or sync.
   */
  init(): Promise<void> | void;
}

/** @deprecated Use {@link AsyncInitializable} instead */
export type Initializable = AsyncInitializable;
/** @deprecated Use {@link AsyncDependency} instead */
export type Dependency = AsyncDependency;
