import {
  defer,
  distinctUntilChanged,
  filter,
  map,
  mergeMap,
  pairwise,
  startWith,
  Subscription,
  switchMap,
} from "rxjs";

import {
  BADGE_MEMORY,
  GlobalState,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/common/platform/state";

import { difference } from "./array-utils";
import { BadgeBrowserApi, RawBadgeState } from "./badge-browser-api";
import { DefaultBadgeState } from "./consts";
import { BadgeStatePriority } from "./priority";
import { BadgeState, Unset } from "./state";

interface StateSetting {
  priority: BadgeStatePriority;
  state: BadgeState;
  tabId?: number;
}

const BADGE_STATES = new KeyDefinition(BADGE_MEMORY, "badgeStates", {
  deserializer: (value: Record<string, StateSetting>) => value ?? {},
});

export class BadgeService {
  private states: GlobalState<Record<string, StateSetting>>;

  constructor(
    private stateProvider: StateProvider,
    private badgeApi: BadgeBrowserApi,
  ) {
    this.states = this.stateProvider.getGlobal(BADGE_STATES);
  }

  /**
   * Start listening for badge state changes.
   * Without this the service will not be able to update the badge state.
   */
  startListening(): Subscription {
    const initialSetup$ = defer(async () => {
      const openTabs = await this.badgeApi.getTabs();
      await this.badgeApi.setState(DefaultBadgeState);
      for (const tabId of openTabs) {
        await this.badgeApi.setState(DefaultBadgeState, tabId);
      }
    });

    return initialSetup$
      .pipe(
        switchMap(() => this.states.state$),
        startWith({}),
        distinctUntilChanged(),
        map((states) => new Set(states ? Object.values(states) : [])),
        pairwise(),
        map(([previous, current]) => {
          const [removed, added] = difference(previous, current);
          return { states: current, removed, added };
        }),
        filter(({ removed, added }) => removed.size > 0 || added.size > 0),
        mergeMap(async ({ states, removed, added }) => {
          const changed = [...removed, ...added];
          const changedTabIds = new Set(
            changed.map((s) => s.tabId).filter((tabId) => tabId !== undefined),
          );
          const onlyTabSpecificStatesChanged = changed.every((s) => s.tabId != undefined);
          if (onlyTabSpecificStatesChanged) {
            // If only tab-specific states changed then we only need to update those specific tabs.
            for (const tabId of changedTabIds) {
              const newState = this.calculateState(states, tabId);
              await this.badgeApi.setState(newState, tabId);
            }
            return;
          }

          // If there are any general states that changed then we need to update all tabs.
          const openTabs = await this.badgeApi.getTabs();
          const generalState = this.calculateState(states);
          await this.badgeApi.setState(generalState);
          for (const tabId of openTabs) {
            const newState = this.calculateState(states, tabId);
            await this.badgeApi.setState(newState, tabId);
          }
        }),
      )
      .subscribe();
  }

  /**
   * Inform badge service of a new state that the badge should reflect.
   *
   * This will merge the new state with any existing states:
   * - If the new state has a higher priority, it will override any lower priority states.
   * - If the new state has a lower priority, it will be ignored.
   * - If the name of the state is already in use, it will be updated.
   * - If the state has a `tabId` set, it will only apply to that tab.
   *   - States with `tabId` can still be overridden by states without `tabId` if they have a higher priority.
   *
   * @param name The name of the state. This is used to identify the state and will be used to clear it later.
   * @param priority The priority of the state (higher numbers are higher priority, but setting arbitrary numbers is not supported).
   * @param state The state to set.
   * @param tabId Limit this badge state to a specific tab. If this is not set, the state will be applied to all tabs.
   */
  async setState(name: string, priority: BadgeStatePriority, state: BadgeState, tabId?: number) {
    await this.states.update((s) => ({ ...s, [name]: { priority, state, tabId } }));
  }

  /**
   * Clear the state with the given name.
   *
   * This will remove the state from the badge service and clear it from the badge.
   * If the state is not found, nothing will happen.
   *
   * @param name The name of the state to clear.
   */
  async clearState(name: string) {
    await this.states.update((s) => {
      const newStates = { ...s };
      delete newStates[name];
      return newStates;
    });
  }

  private calculateState(states: Set<StateSetting>, tabId?: number): RawBadgeState {
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
