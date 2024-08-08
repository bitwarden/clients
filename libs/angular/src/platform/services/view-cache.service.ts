import { Injector, signal, WritableSignal } from "@angular/core";
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
 * Persist state when opening/closing the extension popup
 */
export class ViewCacheService {
  /**
   * Create a signal from a previously cached value. Whenever the signal is updated, the new value is saved to the cache.
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
  signal<T>(options: SignalCacheOptions<T>): WritableSignal<T> {
    return signal(options.initialValue);
  }

  /**
   * - Initialize a form from a cached value
   * - Save form value to cache when it changes
   * - The form is marked dirty if the restored value is not `undefined`.
   **/
  formGroup<TFormGroup extends FormGroup>(options: FormCacheOptions<TFormGroup>): TFormGroup {
    return options.control;
  }
}
