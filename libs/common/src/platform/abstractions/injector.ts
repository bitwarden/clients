import { Dependency } from "./initializable";

/**
 * Framework-agnostic dependency injection interface.
 * Minimal abstraction for resolving service tokens to instances.
 */
export interface Injector {
  /**
   * Resolves a dependency token to its concrete instance.
   * @throws Error if token cannot be resolved
   */
  get<T>(token: Dependency): T;
}
