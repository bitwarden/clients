import { GlobalState } from "./global-state";
import { KeyDefinition } from "./key-definition";

/**
 * A provider for getting an implementation of global state scoped to the given key.
 */
export abstract class GlobalStateProvider {
  /**
   * Gets a {@link GlobalState} scoped to the given {@link KeyDefinition}
   * @param keyDefinition - The {@link KeyDefinition} for which you want the state for.
   */
  abstract get<T>(keyDefinition: KeyDefinition<T>): GlobalState<T>;
}
