import {
  BehaviorSubject,
  combineLatest,
  combineLatestWith,
  concatMap,
  map,
  merge,
  Observable,
  of,
  startWith,
  Subscription,
  switchMap,
} from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  BADGE_MEMORY,
  GlobalState,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/common/platform/state";

import { BadgeBrowserApi, RawBadgeState, Tab } from "./badge-browser-api";
import { DefaultBadgeState } from "./consts";
import { BadgeStatePriority } from "./priority";
import { BadgeState, Unset } from "./state";

export interface BadgeStateSetting {
  priority: BadgeStatePriority;
  state: BadgeState;
  tabId?: number;
}

export type DynamicStateFunction = (
  tab: Tab,
) => Observable<Omit<BadgeStateSetting, "tabId"> | undefined>;

const BADGE_STATES = new KeyDefinition(BADGE_MEMORY, "badgeStates", {
  deserializer: (value: Record<string, BadgeStateSetting>) => value ?? {},
  cleanupDelayMs: 0,
});

export class BadgeService {
  private serviceState: GlobalState<Record<string, BadgeStateSetting>>;
  private dynamicStateFunctions = new BehaviorSubject<Record<string, DynamicStateFunction>>({});

  getActiveTabs(): Promise<Tab[]> {
    return this.badgeApi.getActiveTabs();
  }

  constructor(
    private stateProvider: StateProvider,
    private badgeApi: BadgeBrowserApi,
    private logService: LogService,
  ) {
    this.serviceState = this.stateProvider.getGlobal(BADGE_STATES);
  }

  /**
   * Start listening for badge state changes.
   * Without this the service will not be able to update the badge state.
   */
  startListening(): Subscription {
    // Default state function that always returns an empty state with lowest priority.
    // This will ensure that there is always at least one state to consider when calculating the final badge state,
    // so that the badge is cleared/set to default when no other states are set.
    const defaultTabStateFunction: DynamicStateFunction = (_tab) =>
      of({
        priority: BadgeStatePriority.Low,
        state: {},
      });

    return combineLatest({
      activeTabs: this.badgeApi.activeTabs$,
      dynamicStateFunctions: this.dynamicStateFunctions,
    })
      .pipe(
        switchMap(({ activeTabs, dynamicStateFunctions }) => {
          const functions = [...Object.values(dynamicStateFunctions), defaultTabStateFunction];

          const x = activeTabs.map((tab) =>
            combineLatest(functions.map((f) => f(tab).pipe(startWith(undefined)))).pipe(
              map((states) => ({
                states: states.filter((s): s is BadgeStateSetting => s !== undefined),
                tab,
              })),
            ),
          );

          return merge(...x);
        }),
        combineLatestWith(this.serviceState.state$),
        concatMap(async ([dynamicStates, staticStates]) => {
          const allStates = [...dynamicStates.states, ...Object.values(staticStates ?? {})];
          await this.updateBadge(allStates, dynamicStates.tab.tabId);
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

  // /**
  //  * Inform badge service of a new static state that the badge should reflect.
  //  * This is a one-time setting of the state that will persist until cleared.
  //  *
  //  * This will merge the new state with any existing states:
  //  * - If the new state has a higher priority, it will override any lower priority states.
  //  * - If the new state has a lower priority, it will be ignored.
  //  * - If the name of the state is already in use, it will be updated.
  //  * - If the state has a `tabId` set, it will only apply to that tab.
  //  *   - States with `tabId` can still be overridden by states without `tabId` if they have a higher priority.
  //  *
  //  * @param name The name of the state. This is used to identify the state and will be used to clear it later.
  //  * @param priority The priority of the state (higher numbers are higher priority, but setting arbitrary numbers is not supported).
  //  * @param state The state to set.
  //  * @param tabId Limit this badge state to a specific tab. If this is not set, the state will be applied to all tabs.
  //  */
  async setState(name: string, priority: BadgeStatePriority, state: BadgeState, tabId?: number) {
    throw new Error("Deprecated");
    // await this.serviceState.update((s) => ({
    //   ...s,
    //   [name]: { priority, state, tabId },
    // }));
    // await this.updateBadge(newServiceState, tabId);
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
  setDynamicState(name: string, dynamicStateFunction: DynamicStateFunction) {
    this.dynamicStateFunctions.next({
      ...this.dynamicStateFunctions.value,
      [name]: dynamicStateFunction,
    });
  }

  /**
   * Clear a dynamic state function previously registered with `setDynamicState`.
   *
   * This will:
   * - Stop the function from being called on future tab changes
   * - Unsubscribe from any existing observables created by the function.
   * - Clear any badge state previously set by the function.
   *
   * @param name The name of the dynamic state function to clear.
   */
  clearDynamicState(name: string) {
    const currentDynamicStateFunctions = this.dynamicStateFunctions.value;
    const newDynamicStateFunctions = { ...currentDynamicStateFunctions };
    delete newDynamicStateFunctions[name];
    this.dynamicStateFunctions.next(newDynamicStateFunctions);
  }

  private calculateState(states: Set<BadgeStateSetting>, tabId?: number): RawBadgeState {
    const sortedStates = [...states].sort((a, b) => a.priority - b.priority);

    let filteredStates = sortedStates;
    if (tabId !== undefined) {
      // Filter out states that are not applicable to the current tab.
      // If a state has no tabId, it is considered applicable to all tabs.
      // If a state has a tabId, it is only applicable to that tab.
      filteredStates = sortedStates.filter((s) => s.tabId === tabId || s.tabId === undefined);
    } else {
      // If no tabId is provided, we only want states that are not tab-specific.
      filteredStates = sortedStates.filter((s) => s.tabId === undefined);
    }

    const mergedState = filteredStates
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
  private async updateBadge(
    serviceState: Record<string, BadgeStateSetting> | BadgeStateSetting[] | null | undefined,
    tabId: number | undefined,
    activeTabs?: Tab[],
  ) {
    activeTabs = activeTabs ?? (await this.badgeApi.getActiveTabs());
    if (tabId !== undefined && !activeTabs.some((tab) => tab.tabId === tabId)) {
      return; // No need to update the badge if the state is not for the active tab.
    }

    const tabIdsToUpdate = tabId ? [tabId] : activeTabs.map((tab) => tab.tabId);

    for (const tabId of tabIdsToUpdate) {
      if (tabId === undefined) {
        continue; // Skip if tab id is undefined.
      }

      const newBadgeState = this.calculateState(new Set(Object.values(serviceState ?? {})), tabId);
      try {
        await this.badgeApi.setState(newBadgeState, tabId);
      } catch (error) {
        this.logService.error("Failed to set badge state", error);
      }
    }

    if (tabId === undefined) {
      // If no tabId was provided we should also update the general badge state
      const newBadgeState = this.calculateState(new Set(Object.values(serviceState ?? {})));

      try {
        await this.badgeApi.setState(newBadgeState, tabId);
      } catch (error) {
        this.logService.error("Failed to set general badge state", error);
      }
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
