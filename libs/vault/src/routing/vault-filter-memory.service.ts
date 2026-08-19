import { computed, inject, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Params, Router } from "@angular/router";
import { debounceTime, filter, Subject } from "rxjs";

import {
  StateProvider,
  UserKeyDefinition,
  VAULT_FILTER_DISK,
} from "@bitwarden/common/platform/state";

import { rememberableParams, VaultScope, vaultScopeOf } from "./vault-scope";

/** Remembered filter params, keyed by the scope they were seen under. */
type RememberedParams = Partial<Record<VaultScope, Params>>;

/**
 * Remembered vault filters, by scope. Kept across locks so that returning to the vault the next
 * day restores the filters from the day before — on web an unlock is the start of most sessions,
 * so clearing here would leave nothing to restore.
 */
export const VAULT_FILTER_MEMORY = UserKeyDefinition.record<Params>(
  VAULT_FILTER_DISK,
  "vaultFilterMemory",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
  },
);

/** How long to wait after the last recorded change before writing it to state. */
const PERSIST_DEBOUNCE_INTERVAL = 500;

/**
 * Remembers the filters each vault route was last viewed with, so the side nav can return the user
 * to where they left off.
 *
 * The vault table already mirrors its chips and sort to the URL, so this stores the URL's own
 * query params rather than a second representation of the same state — see
 * {@link rememberableParams} for which ones, and {@link vaultScopeOf} for how a route resolves to a
 * scope. Recording happens on navigation, which the table's URL sync triggers on every chip
 * change, so the memory keeps up without the table knowing it exists.
 *
 * Restoring is the caller's job: read {@link paramsFor} and build the link with them.
 */
@Injectable({ providedIn: "root" })
export class VaultFilterMemoryService {
  private readonly router = inject(Router);
  private readonly state = inject(StateProvider).getActive(VAULT_FILTER_MEMORY);

  /** Scopes recorded this session, which take precedence over what was read from state. */
  private readonly session = signal<RememberedParams>({});

  private readonly stored = toSignal(this.state.state$, { initialValue: null });

  /** Signals that {@link session} has changed and is due to be written. */
  private readonly writes = new Subject<void>();

  /**
   * Merged per scope rather than whole: a navigation recorded before the stored value arrives
   * would otherwise shadow every scope it didn't touch.
   */
  private readonly remembered = computed<RememberedParams>(() => ({
    ...(this.stored() ?? {}),
    ...this.session(),
  }));

  constructor() {
    this.writes
      .pipe(debounceTime(PERSIST_DEBOUNCE_INTERVAL), takeUntilDestroyed())
      .subscribe(() => {
        const recorded = this.session();
        // Updating rather than replacing so an in-memory view that's missing a scope — because
        // it was recorded before the read resolved — can't drop it from state.
        void this.state.update((prev) => ({ ...prev, ...recorded }));
      });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.record());
  }

  /** The remembered filter params for a scope, or `{}` if it hasn't been visited. */
  paramsFor(scope: VaultScope): Params {
    return this.remembered()[scope] ?? {};
  }

  private record(): void {
    const state = this.router.routerState.snapshot;
    const scope = vaultScopeOf(state);
    if (scope == null) {
      return;
    }
    const params = rememberableParams(state.root.queryParams);
    this.session.update((session) => ({ ...session, [scope]: params }));
    this.writes.next();
  }
}
