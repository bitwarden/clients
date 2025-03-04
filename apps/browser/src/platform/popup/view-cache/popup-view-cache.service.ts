// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
import { Jsonify } from "type-fest";

import {
  FormCacheOptions,
  SignalCacheOptions,
  ViewCacheService,
} from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";

import {
  ClEAR_VIEW_CACHE_COMMAND,
  POPUP_VIEW_CACHE_KEY,
  SAVE_VIEW_CACHE_COMMAND,
} from "../../services/popup-view-cache-background.service";

/**
 * Popup implementation of {@link ViewCacheService}.
 *
 * Persists user changes between popup open and close
 */
@Injectable({
  providedIn: "root",
})
export class PopupViewCacheService implements ViewCacheService {
  private globalStateProvider = inject(GlobalStateProvider);
  private messageSender = inject(MessageSender);
  private router = inject(Router);

  private _cache: Record<string, string>;
  private get cache(): Record<string, string> {
    if (!this._cache) {
      throw new Error("Dirty View Cache not initialized");
    }
    return this._cache;
  }

  /**
   * Initialize the service. This should only be called once.
   */
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

  /**
   * @see {@link ViewCacheService.signal}
   */
  signal<T>(options: SignalCacheOptions<T>): WritableSignal<T> {
    const {
      deserializer = (v: Jsonify<T>): T => v as T,
      key,
      injector = inject(Injector),
      initialValue,
    } = options;
    const cachedValue = this.cache[key] ? deserializer(JSON.parse(this.cache[key])) : initialValue;
    const _signal = signal(cachedValue);

    effect(
      () => {
        this.updateState(key, JSON.stringify(_signal()));
      },
      { injector },
    );

    return _signal;
  }

  /**
   * @see {@link ViewCacheService.formGroup}
   */
  formGroup<TFormGroup extends FormGroup>(options: FormCacheOptions<TFormGroup>): TFormGroup {
    const { control, injector } = options;

    const _signal = this.signal({
      ...options,
      initialValue: control.getRawValue(),
    });

    const value = _signal();
    if (value !== undefined && JSON.stringify(value) !== JSON.stringify(control.getRawValue())) {
      control.setValue(value);
      control.markAsDirty();
    }

    control.valueChanges.pipe(takeUntilDestroyed(injector?.get(DestroyRef))).subscribe(() => {
      _signal.set(control.getRawValue());
    });

    return control;
  }

  private updateState(key: string, value: string) {
    this.messageSender.send(SAVE_VIEW_CACHE_COMMAND, {
      key,
      value,
    });
  }

  private clearState() {
    this._cache = {}; // clear local cache
    this.messageSender.send(ClEAR_VIEW_CACHE_COMMAND, {});
  }
}
