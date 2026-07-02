import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";

import {
  DEFAULT_PASSWORD_MANAGER_PROMPT_DISMISSED,
  DEFAULT_PASSWORD_MANAGER_PROMPT_FRESH_INSTALL,
} from "../../default-password-manager-prompt-state.accessor";

@Injectable({
  providedIn: "root",
})
export class DefaultPasswordManagerPromptService {
  private configService = inject(ConfigService);
  private stateProvider = inject(StateProvider);

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

  async isEnabled(): Promise<boolean> {
    return this.configService.getFeatureFlag(FeatureFlag.DefaultPasswordManagerPrompt);
  }

  async setPromptDismissed(): Promise<void> {
    await this.promptDismissedState.update(() => true);
  }
}
