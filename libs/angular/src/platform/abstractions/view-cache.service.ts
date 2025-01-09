import { Injector, WritableSignal } from "@angular/core";
import type { FormGroup } from "@angular/forms";
import type { Jsonify, JsonValue } from "type-fest";

type Deserializer<T> = {
  /**
   * A function to use to safely convert your type from json to your expected type.
   *
   * @param jsonValue The JSON object representation of your state.
   * @returns The fully typed version of your state.
   */
  readonly deserializer?: (jsonValue: Jsonify<T>) => T;
};

type BaseCacheOptions<T> = {
  /** A unique key for saving the cached value to state */
  key: string;

  /** An optional injector. Required if the method is called outside of an injection context. */
  injector?: Injector;
} & (T extends JsonValue ? Deserializer<T> : Required<Deserializer<T>>);

export type SignalCacheOptions<T> = BaseCacheOptions<T> & {
  /** The initial value for the signal. */
  initialValue: T;
};

/** Extract the value type from a FormGroup */
type FormValue<TFormGroup extends FormGroup> = TFormGroup["value"];

export type FormCacheOptions<TFormGroup extends FormGroup> = BaseCacheOptions<
  FormValue<TFormGroup>
> & {
  control: TFormGroup;
};

/**
 * Cache for temporary component state
 *
 * #### Implementations
 * - browser extension popup: used to persist UI between popup open and close
 * - all other clients: noop
 */
export abstract class ViewCacheService {
  /**
   * Create a signal from a previously cached value. Whenever the signal is updated, the new value is saved to the cache.
   *
   * Non browser extension implementations are noop and return a normal signal.
   *
   * @returns the created signal
   *
   * @example
   * ```ts
   * const mySignal = this.viewCacheService.signal({
   *   key: "popup-search-text"
   *   initialValue: ""
   * });
   * ```
   */
  abstract signal<T>(options: SignalCacheOptions<T>): WritableSignal<T>;

  /**
   * - Initialize a form from a cached value
   * - Save form value to cache when it changes
   * - The form is marked dirty if the restored value is not `undefined`.
   *
   * Non browser extension implementations are noop and return the original form group.
   *
   * @example
   * ```ts
   * this.loginDetailsForm = this.viewCacheService.formGroup({
   *   key: "vault-login-details-form",
   *   control: this.formBuilder.group({
   *     username: [""],
   *     email: [""],
   *   })
   * });
   * ```
   **/
  abstract formGroup<TFormGroup extends FormGroup>(
    options: FormCacheOptions<TFormGroup>,
  ): TFormGroup;
}
