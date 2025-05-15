import { BadgeBrowserApi } from "./badge-browser-api";
import { DefaultBadgeState } from "./consts";
import { BadgeStatePriority } from "./priority";
import { BadgeState } from "./state";

export class BadgeService {
  private states: Record<string, { priority: BadgeStatePriority; state: BadgeState }> = {};

  constructor() {}

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
    this.states[name] = { priority, state };

    await BadgeBrowserApi.setState(this.calculateState());
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
    delete this.states[name];

    await BadgeBrowserApi.setState(this.calculateState());
  }

  private calculateState(): BadgeState {
    const states = Object.values(this.states).sort((a, b) => a.priority - b.priority);

    const mergedState = states
      .map((s) => s.state)
      .reduce(
        (acc, state) => ({
          ...acc,
          ...state,
        }),
        DefaultBadgeState,
      );

    return mergedState;
  }
}
