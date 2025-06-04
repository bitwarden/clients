import { defer, filter, map, mergeMap, pairwise, Subscription, switchMap } from "rxjs";

import {
  BADGE_MEMORY,
  GlobalState,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/common/platform/state";

import { BadgeBrowserApi, RawBadgeState } from "./badge-browser-api";
import { DefaultBadgeState } from "./consts";
import { BadgeStatePriority } from "./priority";
import { BadgeState, Unset } from "./state";
import { difference } from "./array-utils";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

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
    private logService: LogService,
  ) {
    this.states = this.stateProvider.getGlobal(BADGE_STATES);
  }

  /**
   * Start listening for badge state changes.
   * Without this the service will not be able to update the badge state.
   */
  startListening(): Subscription {
    const initialSetup$ = defer(async () => await this.badgeApi.setState(DefaultBadgeState));

    return initialSetup$
      .pipe(
        switchMap(() => this.states.state$),
        map((states) => new Set(states ? Object.values(states) : [])),
        pairwise(),
        map(([previous, current]) => {
          const [removed, added] = difference(previous, current);
          return { states: current, removed, added };
        }),
        filter(({ removed, added }) => removed.size > 0 || added.size > 0),
        mergeMap(async ({ states, removed, added }) => {
          const changed = [...removed, ...added];

          if (changed.some((s) => s.tabId === undefined)) {
            const genericStates = Array.from(states).filter((s) => s.tabId === undefined);
            const genericState = this.calculateState(Array.from(genericStates), DefaultBadgeState);
            await this.badgeApi.setState(genericState);
          }

          const changedTabIds = new Set(
            changed.map((s) => s.tabId).filter((tabId) => tabId !== undefined),
          );
          for (const tabId of changedTabIds) {
            const specificState = this.calculateState(
              [...Array.from(states).filter((s) => s.tabId === tabId)],
              {},
            );

            try {
              await this.badgeApi.setState(specificState, tabId);
            } catch (error) {
              this.logService.error(
                "[BadgeService] Error setting badge state for tab",
                tabId,
                error,
              );
            }
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
   * - States with `tabId` set will always override states without `tabId` set, regardless of priority.
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

  private calculateState(
    states: StateSetting[],
    defaultState: RawBadgeState & BadgeState,
  ): RawBadgeState {
    let sortedStates = [...states].sort((a, b) => a.priority - b.priority);

    const mergedState = sortedStates
      .map((s) => s.state)
      .reduce<Partial<RawBadgeState>>((acc: Partial<RawBadgeState>, state: BadgeState) => {
        const newState = { ...acc };

        for (const k in state) {
          const key = k as keyof BadgeState & keyof RawBadgeState;
          setStateValue(newState, state, key);
        }

        return newState;
      }, defaultState);

    return {
      ...defaultState,
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
