import { Observable, combineLatest, map, startWith } from "rxjs";

import {
  ActiveUserState,
  ActiveUserStateProvider,
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
  SingleUserState,
  SingleUserStateProvider,
  UserKeyDefinition,
} from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { lookupOverlay } from "./managed-overlay-registry";
import { ManagedSettingsService } from "./managed-settings.service";

/**
 * Wraps a state holder so its `state$` emits the managed value whenever the key has a registered
 * overlay present in the active profile. Only `state$` is replaced; all other members delegate.
 * The overlay is resolved per emission so a holder captured before registration still honors a
 * late-arriving profile (PM-26324).
 */
export function overlayStateHolder<H extends { state$: Observable<unknown> }>(
  holder: H,
  keyDefinition: KeyDefinition<unknown> | UserKeyDefinition<unknown>,
  managedSettings: ManagedSettingsService,
): H {
  const overlaid$ = combineLatest([
    holder.state$,
    managedSettings.changes$.pipe(startWith(undefined as void)),
  ]).pipe(
    map(([stored]) => {
      const overlay = lookupOverlay(keyDefinition);
      if (overlay == null) {
        return stored;
      }
      const coerced = overlay.coerce((key) => managedSettings.get(key));
      return coerced == null ? stored : coerced;
    }),
  );
  return new Proxy(holder, {
    get(target, prop, receiver) {
      return prop === "state$" ? overlaid$ : Reflect.get(target, prop, receiver);
    },
  });
}

export class OverlayGlobalStateProvider extends GlobalStateProvider {
  constructor(
    private readonly inner: GlobalStateProvider,
    private readonly managedSettings: ManagedSettingsService,
  ) {
    super();
  }

  get<T>(keyDefinition: KeyDefinition<T>): GlobalState<T> {
    return overlayStateHolder(this.inner.get(keyDefinition), keyDefinition, this.managedSettings);
  }
}

export class OverlaySingleUserStateProvider extends SingleUserStateProvider {
  constructor(
    private readonly inner: SingleUserStateProvider,
    private readonly managedSettings: ManagedSettingsService,
  ) {
    super();
  }

  get<T>(userId: UserId, userKeyDefinition: UserKeyDefinition<T>): SingleUserState<T> {
    return overlayStateHolder(
      this.inner.get(userId, userKeyDefinition),
      userKeyDefinition,
      this.managedSettings,
    );
  }
}

export class OverlayActiveUserStateProvider extends ActiveUserStateProvider {
  constructor(
    private readonly inner: ActiveUserStateProvider,
    private readonly managedSettings: ManagedSettingsService,
  ) {
    super();
  }

  get activeUserId$(): Observable<UserId | undefined> {
    return this.inner.activeUserId$;
  }

  get<T>(userKeyDefinition: UserKeyDefinition<T>): ActiveUserState<T> {
    return overlayStateHolder(
      this.inner.get(userKeyDefinition),
      userKeyDefinition,
      this.managedSettings,
    );
  }
}
