import { UserKeyDefinition, UserKeyDefinitionOptions } from "../../platform/state";
// eslint-disable-next-line -- `StateDefinition` used as an argument
import { StateDefinition } from "../../platform/state/state-definition";

/** A set of options for customizing the behavior of a {@link BufferedKeyDefinition}
 */
export type BufferedKeyDefinitionOptions<Input, Output, Dependency> =
  UserKeyDefinitionOptions<Input> & {
    /** Checks whether the input type can be converted to the output type.
     *  @param input the data that is rolling over.
     *  @returns `true` if the definition is valid, otherwise `false`. If this
     *  function is not specified, any truthy input is valid.
     *
     * @remarks this is intended for cases where you're working with validated or
     * signed data. It should be used to prevent data from being "laundered" through
     * synchronized state.
     */
    isValid?: (input: Input, dependency: Dependency) => Promise<boolean>;

    /** Transforms the input data format to its output format.
     *  @param input the data that is rolling over.
     *  @returns the converted value. If this function is not specified, the value
     *  is asserted as the output type.
     *
     * @remarks This is intended for converting between, say, a replication format
     * and a disk format or rotating encryption keys.
     */
    map?: (input: Input, dependency: Dependency) => Promise<Output>;

    /** Checks whether an overwrite should occur
     *  @param dependency the latest value from the dependency observable provided
     *    to the buffered state.
     *  @returns `true` if a overwrite should occur, otherwise `false`. If this
     *   function is not specified, overwrites occur when the dependency is truthy.
     *
     *  @remarks This is intended for waiting to overwrite until a dependency becomes
     *   available (e.g. an encryption key or a user confirmation).
     */
    shouldOverwrite?: (dependency: Dependency) => boolean;
  };

/** Storage and mapping settings for data stored by a `BufferedState`.
 */
export class BufferedKeyDefinition<Input, Output = Input, Dependency = true> {
  /**
   * Defines a buffered state
   * @param stateDefinition The domain of the buffer
   * @param key Domain key that identifies the buffered value. This key must
   *    not be reused in any capacity.
   * @param options Configures the operation of the buffered state.
   */
  constructor(
    readonly stateDefinition: StateDefinition,
    readonly key: string,
    readonly options: BufferedKeyDefinitionOptions<Input, Output, Dependency>,
  ) {}

  /** Converts the buffered key definition to a state provider
   *  key definition
   */
  toKeyDefinition() {
    const bufferedKey = new UserKeyDefinition<Input>(this.stateDefinition, this.key, this.options);

    return bufferedKey;
  }

  /** Checks whether the dependency triggers an overwrite. */
  shouldOverwrite(dependency: Dependency) {
    const shouldOverwrite = this.options?.shouldOverwrite;
    if (shouldOverwrite) {
      return shouldOverwrite(dependency);
    }

    return dependency ? true : false;
  }

  /** Converts the input data format to its output format.
   *  @returns the converted value.
   */
  map(input: Input, dependency: Dependency) {
    const map = this.options?.map;
    if (map) {
      return map(input, dependency);
    }

    return Promise.resolve(input as unknown as Output);
  }

  /** Checks whether the input type can be converted to the output type.
   *  @returns `true` if the definition is defined and valid, otherwise `false`.
   */
  isValid(input: Input, dependency: Dependency) {
    if (input === null) {
      return Promise.resolve(false);
    }

    const isValid = this.options?.isValid;
    if (isValid) {
      return isValid(input, dependency);
    }

    return Promise.resolve(input ? true : false);
  }
}
