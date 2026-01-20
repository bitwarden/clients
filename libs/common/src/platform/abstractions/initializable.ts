declare const Dependency: FunctionConstructor;
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export interface Dependency extends Function {
  prototype: Initializable;
}

/**
 * Services that implement Initializable can participate in decentralized initialization.
 * Each service declares its dependencies, and initialization will execute them in the
 * correct order using topological sort.
 *
 * This is a framework-agnostic abstraction that can be used across all clients.
 */
export interface Initializable {
  /**
   * List of service classes that must be initialized before this service.
   * Use actual class references for type safety and refactoring support.
   *
   * Note: The exact type depends on the framework. For Angular, use Type<Initializable>.
   * For non-Angular clients, use the constructor type directly.
   */
  dependencies?: Dependency[];

  /**
   * Initialize this service. Called after all dependencies have been initialized.
   * Can be async or sync.
   */
  init(): Promise<void> | void;
}
