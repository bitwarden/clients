import { BadgeBrowserApi } from "./badge-browser-api";
import { DefaultBadgeState } from "./consts";
import { BadgeStatePriority } from "./priority";
import { BadgeState } from "./state";

export class BadgeService {
  private states: Record<string, { priority: BadgeStatePriority; state: BadgeState }> = {};

  constructor() {}

  async setState(name: string, priority: BadgeStatePriority, state: BadgeState) {
    this.states[name] = { priority, state };

    await BadgeBrowserApi.setState(this.calculateState());
  }

  async clearState(name: string) {}

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
