import { Injectable } from "@angular/core";
import { Observable, map } from "rxjs";

import {
  ActiveUserState,
  SM_ONBOARDING_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";

export type SMOnboardingTasks = Record<string, Record<string, boolean>>;

const SM_ONBOARDING_TASKS_KEY = new UserKeyDefinition<SMOnboardingTasks>(
  SM_ONBOARDING_DISK,
  "tasks",
  {
    deserializer: (b) => b,
    clearOn: [], // Used to track tasks completed by a user, we don't want to reshow if they've locked or logged out and came back to the app
  },
);

@Injectable({
  providedIn: "root",
})
export class SMOnboardingTasksService {
  private smOnboardingTasks: ActiveUserState<SMOnboardingTasks>;
  smOnboardingTasks$: Observable<SMOnboardingTasks>;

  constructor(private stateProvider: StateProvider) {
    this.smOnboardingTasks = this.stateProvider.getActive(SM_ONBOARDING_TASKS_KEY);
    this.smOnboardingTasks$ = this.smOnboardingTasks.state$.pipe(map((tasks) => tasks ?? {}));
  }

  async setSmOnboardingTasks(newState: SMOnboardingTasks): Promise<void> {
    await this.smOnboardingTasks.update(() => {
      return { ...newState };
    });
  }
}
