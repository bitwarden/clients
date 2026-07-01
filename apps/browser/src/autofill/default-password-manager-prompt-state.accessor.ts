import {
  GlobalState,
  KeyDefinition,
  StateProvider,
  VAULT_BROWSER_DEFAULT_PASSWORD_MANAGER_PROMPT,
} from "@bitwarden/common/platform/state";

export const DEFAULT_PASSWORD_MANAGER_PROMPT_DISMISSED = new KeyDefinition<boolean>(
  VAULT_BROWSER_DEFAULT_PASSWORD_MANAGER_PROMPT,
  "defaultPasswordManagerPromptDismissed",
  {
    deserializer: (dismissed) => dismissed,
  },
);

export const DEFAULT_PASSWORD_MANAGER_PROMPT_FRESH_INSTALL = new KeyDefinition<boolean>(
  VAULT_BROWSER_DEFAULT_PASSWORD_MANAGER_PROMPT,
  "defaultPasswordManagerPromptFreshInstallEligible",
  {
    deserializer: (eligible) => eligible,
  },
);

export class DefaultPasswordManagerPromptStateAccessor {
  private readonly promptDismissedState: GlobalState<boolean>;
  private readonly freshInstallEligibleState: GlobalState<boolean>;

  constructor(stateProvider: StateProvider) {
    this.promptDismissedState = stateProvider.getGlobal(DEFAULT_PASSWORD_MANAGER_PROMPT_DISMISSED);
    this.freshInstallEligibleState = stateProvider.getGlobal(
      DEFAULT_PASSWORD_MANAGER_PROMPT_FRESH_INSTALL,
    );
  }

  async markFreshInstallEligible(): Promise<void> {
    await this.freshInstallEligibleState.update(() => true);
  }

  async dismissPrompt(): Promise<void> {
    await this.promptDismissedState.update(() => true);
  }
}
