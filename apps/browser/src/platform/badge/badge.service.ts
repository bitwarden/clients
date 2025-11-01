import {
  BehaviorSubject,
  combineLatest,
  combineLatestWith,
  concatMap,
  debounceTime,
  filter,
  groupBy,
  map,
  mergeMap,
  Observable,
  of,
  startWith,
  Subscription,
  switchMap,
  takeUntil,
} from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BadgeBrowserApi, RawBadgeState, Tab } from "./badge-browser-api";
import { DefaultBadgeState } from "./consts";
import { BadgeStatePriority } from "./priority";
import { BadgeState, Unset } from "./state";

const BADGE_UPDATE_DEBOUNCE_MS = 100;

export interface BadgeStateSetting {
  priority: BadgeStatePriority;
  state: BadgeState;
}

/**
 * A function that returns the badge state for a specific tab.
 * Return `undefined` to clear any previously set state for the tab.
 */
export type BadgeStateFunction = (tab: Tab) => Observable<BadgeStateSetting | undefined>;

export class BadgeService {
  private stateFunctions = new BehaviorSubject<Record<string, BadgeStateFunction>>({});

  constructor(
    private badgeApi: BadgeBrowserApi,
    private logService: LogService,
    private debounceTimeMs: number = BADGE_UPDATE_DEBOUNCE_MS,
  ) {}

  /**
   * Start listening for badge state changes.
   * Without this the service will not be able to update the badge state.
   */
  startListening(): Subscription {
    // Default state function that always returns an empty state with lowest priority.
    // This will ensure that there is always at least one state to consider when calculating the final badge state,
    // so that the badge is cleared/set to default when no other states are set.
    const defaultTabStateFunction: BadgeStateFunction = (_tab) =>
      of({
        priority: BadgeStatePriority.Low,
        state: {},
      });

    return this.badgeApi.tabEvents$
      .pipe(
        groupBy((event) => (event.type === "deactivated" ? event.tabId : event.tab.tabId), {
          duration: (group$) =>
            // Allow clean up of group when deactivated event arrives for this tabId
            group$.pipe(filter((evt) => evt.type === "deactivated")),
        }),
        mergeMap((group$) =>
          group$.pipe(
            // ignore deactivation events, only handle updates/activations
            filter((evt) => evt.type !== "deactivated"),
            map((evt) => evt.tab),
            combineLatestWith(this.stateFunctions),
            switchMap(([tab, dynamicStateFunctions]) => {
              const functions = [...Object.values(dynamicStateFunctions), defaultTabStateFunction];

              return combineLatest(functions.map((f) => f(tab).pipe(startWith(undefined)))).pipe(
                map((states) => ({
                  tab,
                  states: states.filter((s): s is BadgeStateSetting => s !== undefined),
                })),
                debounceTime(this.debounceTimeMs),
              );
            }),
            takeUntil(group$.pipe(filter((evt) => evt.type === "deactivated"))),
          ),
        ),

        concatMap(async (tabUpdate) => {
          await this.updateBadge(tabUpdate.states, tabUpdate.tab.tabId);
        }),
      )
      .subscribe({
        error: (error: unknown) => {
          this.logService.error(
            "BadgeService: Fatal error updating badge state. Badge will no longer be updated.",
            error,
          );
        },
      });
  }

  /**
   * Register a function that takes an observable of active tab updates and returns an observable of state settings.
   * This can be used to create dynamic badge states that react to tab changes.
   * The returned observable should emit a new state setting whenever the badge state should be updated.
   *
   * This will merge all states:
   * - If the new state has a higher priority, it will override any lower priority states.
   * - If the new state has a lower priority, it will be ignored.
   * - If the name of the state is already in use, it will be updated.
   * - If the state has a `tabId` set, it will only apply to that tab.
   *   - States with `tabId` can still be overridden by states without `tabId` if they have a higher priority.
   */
  setState(name: string, stateFunction: BadgeStateFunction) {
    this.stateFunctions.next({
      ...this.stateFunctions.value,
      [name]: stateFunction,
    });
  }

  /**
   * Clear a state function previously registered with `setState`.
   *
   * This will:
   * - Stop the function from being called on future tab changes
   * - Unsubscribe from any existing observables created by the function.
   * - Clear any badge state previously set by the function.
   *
   * @param name The name of the state function to clear.
   */
  clearState(name: string) {
    const currentDynamicStateFunctions = this.stateFunctions.value;
    const newDynamicStateFunctions = { ...currentDynamicStateFunctions };
    delete newDynamicStateFunctions[name];
    this.stateFunctions.next(newDynamicStateFunctions);
  }

  private calculateState(states: BadgeStateSetting[]): RawBadgeState {
    const sortedStates = states.sort((a, b) => a.priority - b.priority);

    const mergedState = sortedStates
      .map((s) => s.state)
      .reduce<Partial<RawBadgeState>>((acc: Partial<RawBadgeState>, state: BadgeState) => {
        const newState = { ...acc };

        for (const k in state) {
          const key = k as keyof BadgeState & keyof RawBadgeState;
          setStateValue(newState, state, key);
        }

        return newState;
      }, DefaultBadgeState);

    return {
      ...DefaultBadgeState,
      ...mergedState,
    };
  }

  /**
   * Common function deduplicating the logic for updating the badge with the current state.
   * This will only update the badge if the active tab is the same as the tabId of the latest change.
   * If the active tab is not set, it will not update the badge.
   *
   * @param serviceState The current state of the badge service. If this is null or undefined, an empty set will be assumed.
   * @param tabId Tab id for which the the latest state change applied to. Set this to activeTab.tabId to force an update.
   * @param activeTabs The currently active tabs. If not provided, it will be fetched from the badge API.
   */
  private async updateBadge(serviceState: BadgeStateSetting[], tabId: number) {
    const newBadgeState = this.calculateState(serviceState);
    try {
      await this.badgeApi.setState(newBadgeState, tabId);
    } catch (error) {
      this.logService.error("Failed to set badge state", error);
    }
  }
}

/**
 * Helper value to modify the state variable.
 * TS doesn't like it when this is being doine inline.
 */
function setStateValue<Key extends keyof BadgeState & keyof RawBadgeState>(
  newState: Partial<RawBadgeState>,
  state: BadgeState,
  key: Key,
) {
  if (state[key] === Unset) {
    delete newState[key];
  } else if (state[key] !== undefined) {
    newState[key] = state[key] as RawBadgeState[Key];
  }
}
