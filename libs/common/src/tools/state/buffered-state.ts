// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, combineLatest, concatMap, filter, map, of, concat, merge } from "rxjs";

import {
  StateProvider,
  SingleUserState,
  CombinedState,
  StateUpdateOptions,
} from "../../platform/state";

import { BufferedKeyDefinition } from "./buffered-key-definition";

/** Stateful storage that overwrites one state with a buffered state.
 *  When a overwrite occurs, the input state is automatically deleted.
 *  @remarks The buffered state can only overwrite non-nullish values. If the
 *   buffer key contains `null` or `undefined`, it will do nothing.
 */
export class BufferedState<Input, Output, Dependency> implements SingleUserState<Output> {
  /**
   * Instantiate a buffered state
   * @param provider constructs the buffer.
   * @param key defines the buffer location.
   * @param output updates when a overwrite occurs
   * @param dependency$ provides data the buffer depends upon to evaluate and
   *   transform its data. If this is omitted, then `true` is injected as
   *   a dependency, which with a default output will trigger a overwrite immediately.
   *
   * @remarks `dependency$` enables overwrite control during dynamic circumstances,
   *   such as when a overwrite should occur only if a user key is available.
   */
  constructor(
    provider: StateProvider,
    private key: BufferedKeyDefinition<Input, Output, Dependency>,
    private output: SingleUserState<Output>,
    dependency$: Observable<Dependency> = null,
  ) {
    this.bufferedState = provider.getUser(output.userId, key.toKeyDefinition());

    // overwrite the output value
    const hasValue$ = concat(of(null), this.bufferedState.state$).pipe(
      map((buffer) => (buffer ?? null) !== null),
    );
    const overwriteDependency$ = (dependency$ ?? of(true as unknown as Dependency)).pipe(
      map((dependency) => [key.shouldOverwrite(dependency), dependency] as const),
    );
    const overwrite$ = combineLatest([hasValue$, overwriteDependency$]).pipe(
      concatMap(
        async ([hasValue, [shouldOverwrite, dependency]]): Promise<readonly [false, null]> => {
          if (hasValue && shouldOverwrite) {
            await this.overwriteOutput(dependency);
          }
          return [false, null] as const;
        },
      ),
    );

    // drive overwrites only when there's a subscription;
    // the output state determines when emissions occur
    const output$ = this.output.state$.pipe(map((output) => [true, output] as const));
    this.state$ = merge(overwrite$, output$).pipe(
      filter(([emit]) => emit),
      map(([, output]) => output),
    );

    this.combinedState$ = this.state$.pipe(map((state) => [this.output.userId, state]));

    this.bufferedState$ = this.bufferedState.state$;
  }

  private bufferedState: SingleUserState<Input>;

  private async overwriteOutput(dependency: Dependency) {
    // take the latest value from the buffer
    let buffered: Input;
    await this.bufferedState.update((state): Input | null => {
      buffered = state ?? null;
      return null;
    });

    // update the output state
    const isValid = await this.key.isValid(buffered, dependency);
    if (isValid) {
      const output = await this.key.map(buffered, dependency);
      await this.output.update(() => output);
    }
  }

  /** {@link SingleUserState.userId} */
  get userId() {
    return this.output.userId;
  }

  /** Observes changes to the output state. This updates when the output
   *  state updates, when the buffer is moved to the output, and when `BufferedState.buffer`
   *  is invoked.
   */
  readonly state$: Observable<Output>;

  /** {@link SingleUserState.combinedState$} */
  readonly combinedState$: Observable<CombinedState<Output>>;

  /** Buffers a value state. The buffered state overwrites the output
   *  state when a subscription occurs.
   *  @param value the state to roll over. Setting this to `null` or `undefined`
   *  has no effect.
   */
  async buffer(value: Input): Promise<void> {
    const normalized = value ?? null;
    if (normalized !== null) {
      await this.bufferedState.update(() => normalized);
    }
  }

  /** The data presently being buffered. This emits the pending value each time
   *  new buffer data is provided. It emits null when the buffer is empty.
   */
  readonly bufferedState$: Observable<Input>;

  /** Updates the output state.
   *  @param configureState a callback that returns an updated output
   *   state. The callback receives the state's present value as its
   *   first argument and the dependencies listed in `options.combinedLatestWith`
   *   as its second argument.
   *  @param options configures how the update is applied. See {@link StateUpdateOptions}.
   */
  update<TCombine>(
    configureState: (state: Output, dependencies: TCombine) => Output,
    options: StateUpdateOptions<Output, TCombine> = null,
  ): Promise<Output> {
    return this.output.update(configureState, options);
  }
}
