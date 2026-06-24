import { Observable, combineLatest, map, startWith } from "rxjs";

import {
  ActiveUserState,
  DeriveDefinition,
  DerivedState,
  GlobalState,
  KeyDefinition,
  SingleUserState,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { DerivedStateDependencies } from "../../types/state";

import { lookupOverlay } from "./managed-overlay-registry";
import { ManagedSettingsService } from "./managed-settings.service";

/**
 * Decorates a StateProvider so reads of any key with a registered managed
 * overlay emit the managed value when that key is present in the active
 * profile. Consumers are unchanged: they still call `getGlobal(KEY).state$`.
 *
 * Only `state$` is overlaid. `update()` and every other member delegate to the
 * inner holder unchanged — a write still reaches storage but is masked on read
 * while the key is managed (presence == forced).
 */
export class ManagedOverlayStateProvider extends StateProvider {
  constructor(
    private readonly inner: StateProvider,
    private readonly managedSettings: ManagedSettingsService,
  ) {
    super();
  }

  get activeUserId$() {
    return this.inner.activeUserId$;
  }

  // NOTE: getUserState$ / getUserStateOrDefault$ delegate to the inner provider and are
  // NOT overlaid. The honored managed read path is the holder-based getGlobal/getUser/
  // getActive(KEY).state$ (the inner provider's getUserState$ resolves its own getUser, not
  // this overlay's). No consumer reads a managed key through these today; if one ever does,
  // route them through this overlay's getUser/getActive. Tracked for the first real-consumer plan.
  getUserState$<T>(keyDefinition: UserKeyDefinition<T>, userId?: UserId): Observable<T> {
    return this.inner.getUserState$(keyDefinition, userId);
  }

  getUserStateOrDefault$<T>(
    keyDefinition: UserKeyDefinition<T>,
    config: { userId: UserId | undefined; defaultValue?: T },
  ): Observable<T> {
    return this.inner.getUserStateOrDefault$(keyDefinition, config);
  }

  setUserState<T>(
    keyDefinition: UserKeyDefinition<T>,
    value: T | null,
    userId?: UserId,
  ): Promise<[UserId, T | null]> {
    return this.inner.setUserState(keyDefinition, value, userId);
  }

  getDerived<TFrom, TTo, TDeps extends DerivedStateDependencies>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<TFrom, TTo, TDeps>,
    dependencies: TDeps,
  ): DerivedState<TTo> {
    return this.inner.getDerived(parentState$, deriveDefinition, dependencies);
  }

  getGlobal<T>(keyDefinition: KeyDefinition<T>): GlobalState<T> {
    return this.overlay(this.inner.getGlobal(keyDefinition), keyDefinition);
  }

  getActive<T>(userKeyDefinition: UserKeyDefinition<T>): ActiveUserState<T> {
    return this.overlay(this.inner.getActive(userKeyDefinition), userKeyDefinition);
  }

  getUser<T>(userId: UserId, userKeyDefinition: UserKeyDefinition<T>): SingleUserState<T> {
    return this.overlay(this.inner.getUser(userId, userKeyDefinition), userKeyDefinition);
  }

  private overlay<H extends { state$: Observable<unknown> }>(
    holder: H,
    keyDefinition: KeyDefinition<unknown> | UserKeyDefinition<unknown>,
  ): H {
    const overlaid$ = combineLatest([
      holder.state$,
      this.managedSettings.changes$.pipe(startWith(undefined as void)),
    ]).pipe(
      map(([stored]) => {
        // Resolve the overlay per emission, not once at getGlobal/getActive/getUser time:
        // a consumer (e.g. EnvironmentService) may capture this holder before the overlay
        // is registered (Angular APP_INITIALIZER eager-construction order). Per-emission
        // lookup makes late registration take effect.
        const overlay = lookupOverlay(keyDefinition);
        if (overlay == null) {
          return stored;
        }
        const coerced = overlay.coerce((key) => this.managedSettings.get(key));
        return coerced == null ? stored : coerced;
      }),
    );
    return new Proxy(holder, {
      get(target, prop, receiver) {
        return prop === "state$" ? overlaid$ : Reflect.get(target, prop, receiver);
      },
    });
  }
}
