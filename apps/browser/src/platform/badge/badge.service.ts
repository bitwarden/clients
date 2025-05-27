import { mergeMap, Subscription } from "rxjs";

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

interface StateSetting {
  priority: BadgeStatePriority;
  state: BadgeState;
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
    return this.states.state$
      .pipe(
        mergeMap(async (states) => {
          const state = this.calculateState(states ?? {});
          await this.badgeApi.setState(state);
        }),
      )
      .subscribe();
  }

  /**
   * Inform badge service of a new state that the badge should reflect.

   * This will merge the new state with any existing states.
   * If the new state has a higher priority, it will override any lower priority states.
   * If the new state has a lower priority, it will be ignored.
   * If the name of the state is already in use, it will be updated.
   *
   * @param name The name of the state. This is used to identify the state and will be used to clear it later.
   * @param priority The priority of the state (higher numbers are higher priority, but setting arbitrary numbers is not supported).
   * @param state The state to set.
   */
  async setState(name: string, priority: BadgeStatePriority, state: BadgeState) {
    await this.states.update((s) => ({ ...s, [name]: { priority, state } }));
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

  private calculateState(states: Record<string, StateSetting>): RawBadgeState {
    const stateValues = Object.values(states).sort((a, b) => a.priority - b.priority);

    const mergedState = stateValues
      .map((s) => s.state)
      .reduce<Partial<RawBadgeState>>((acc: Partial<RawBadgeState>, state: BadgeState) => {
        const merged = { ...acc };

        for (const k in state) {
          const key = k as keyof BadgeState;

          if (state[key] === Unset) {
            delete merged[key];
          } else if (key === "icon") {
            // Weird if-check but TS doesn't understand that the types are compatible otherwise
            merged[key] = state[key];
          } else {
            merged[key] = state[key];
          }
        }

        return merged;
      }, DefaultBadgeState);

    return {
      ...DefaultBadgeState,
      ...mergedState,
    };
  }
}
