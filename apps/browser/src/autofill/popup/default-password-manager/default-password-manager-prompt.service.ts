import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";

import {
  DEFAULT_PASSWORD_MANAGER_PROMPT_DISMISSED,
  DEFAULT_PASSWORD_MANAGER_PROMPT_FRESH_INSTALL,
} from "../../default-password-manager-prompt-state.accessor";

@Injectable({
  providedIn: "root",
})
export class DefaultPasswordManagerPromptService {
  private promptDismissedState: GlobalState<boolean> = this.stateProvider.getGlobal(
    DEFAULT_PASSWORD_MANAGER_PROMPT_DISMISSED,
  );

  private freshInstallEligibleState: GlobalState<boolean> = this.stateProvider.getGlobal(
    DEFAULT_PASSWORD_MANAGER_PROMPT_FRESH_INSTALL,
  );

  readonly promptDismissed$: Observable<boolean> = this.promptDismissedState.state$.pipe(
    map((dismissed) => dismissed ?? false),
  );

  readonly freshInstallEligible$: Observable<boolean> = this.freshInstallEligibleState.state$.pipe(
    map((eligible) => eligible ?? false),
  );

  constructor(private stateProvider: StateProvider) {}

  async setPromptDismissed(): Promise<void> {
    await this.promptDismissedState.update(() => true);
  }
}
