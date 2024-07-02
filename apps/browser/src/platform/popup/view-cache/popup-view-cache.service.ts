import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  signal,
  WritableSignal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormGroup } from "@angular/forms";
import { NavigationEnd, Router } from "@angular/router";
import { filter, firstValueFrom, skip } from "rxjs";
import { Jsonify, JsonValue } from "type-fest";

import { MessageSender } from "@bitwarden/common/platform/messaging";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";

import {
  ClEAR_VIEW_CACHE_COMMAND,
  POPUP_VIEW_CACHE_KEY,
  SAVE_VIEW_CACHE_COMMAND,
} from "../../services/popup-view-cache-background.service";

type TDeserializer<T> = {
  /**
   * A function to use to safely convert your type from json to your expected type.
   *
   * @param jsonValue The JSON object representation of your state.
   * @returns The fully typed version of your state.
   */
  readonly deserializer?: (jsonValue: Jsonify<T>) => T;
};

type TBaseCacheOptions<T> = {
  /** A unique key for saving the cached value to state */
  key: string;

  /** An optional injector. Required if the method is called outside of an injection context. */
  injector?: Injector;
} & (T extends JsonValue ? TDeserializer<T> : Required<TDeserializer<T>>);

export type TSignalCacheOptions<T> = TBaseCacheOptions<T> & {
  /** The initial value for the signal. */
  initialValue: T;
};

/** Extract the value type from a FormGroup */
type TFormValue<TFormGroup extends FormGroup> = TFormGroup["value"];

export type TFormCacheOptions<TFormGroup extends FormGroup> = TBaseCacheOptions<
  TFormValue<TFormGroup>
> & {
  control: TFormGroup;
};

/**
 * Persist state when opening/closing the extension popup
 */
@Injectable({
  providedIn: "root",
})
export class PopupViewCacheService {
  private globalStateProvider = inject(GlobalStateProvider);
  private messageSender = inject(MessageSender);
  private router = inject(Router);

  private _cache: Record<string, string>;
  get cache(): Record<string, string> {
    if (!this._cache) {
      throw new Error("View cache not initialized");
    }
    return this._cache;
  }

  async init() {
    const initialState = await firstValueFrom(
      this.globalStateProvider.get(POPUP_VIEW_CACHE_KEY).state$,
    );
    this._cache = Object.freeze(initialState ?? {});

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        /** Skip the first navigation triggered by `popupRouterCacheGuard` */
        skip(1),
      )
      .subscribe(() => this.clearState());
  }

  updateState(key: string, value: string) {
    this.messageSender.send(SAVE_VIEW_CACHE_COMMAND, {
      key,
      value,
    });
  }

  clearState() {
    this.messageSender.send(ClEAR_VIEW_CACHE_COMMAND, {});
  }
}
/**
 * Create a signal from a previously cached value. Whenever the signal is updated, the new value is saved to the cache.
 *
 * @returns the created signal
 *
 * @example
 * ```ts
 * const mySignal = cachedSignal({
 *   key: "popup-search-text"
 *   initialValue: ""
 * })
 * ```
 */
export const cacheSignal = <T>(options: TSignalCacheOptions<T>): WritableSignal<T> => {
  const {
    deserializer = (v: Jsonify<T>): T => v as T,
    key,
    injector = inject(Injector),
    initialValue,
  } = options;
  const service = injector.get(PopupViewCacheService);
  const cachedValue = service.cache[key]
    ? deserializer(JSON.parse(service.cache[key]))
    : initialValue;
  const _signal = signal(cachedValue);

  effect(
    () => {
      service.updateState(key, JSON.stringify(_signal()));
    },
    { injector },
  );

  return _signal;
};

/**
 * Initialize a form from cached value changes.
 *
 * The form is marked dirty if a cached value is restored.
 **/
export const cacheFormGroup = <TFormGroup extends FormGroup>(
  options: TFormCacheOptions<TFormGroup>,
) => {
  const { control, injector } = options;

  const _signal = cacheSignal({
    ...options,
    initialValue: control.getRawValue() as TFormValue<TFormGroup>,
  });

  const value = _signal();
  if (value != null && JSON.stringify(value) !== JSON.stringify(control.getRawValue())) {
    control.setValue(value);
    control.markAsDirty();
  }

  control.valueChanges.pipe(takeUntilDestroyed(injector?.get(DestroyRef))).subscribe(() => {
    _signal.set(control.getRawValue());
  });

  return control;
};
