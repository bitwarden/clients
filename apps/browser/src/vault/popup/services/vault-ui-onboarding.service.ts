import { Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  GlobalState,
  KeyDefinition,
  StateProvider,
  VAULT_BROWSER_UI_ONBOARDING,
} from "@bitwarden/common/platform/state";
import { DialogService } from "@bitwarden/components";

import { VaultUiOnboardingComponent } from "../components/vault-v2/vault-ui-onboarding/vault-ui-onboarding.component";

// Key definition for the Vault UI onboarding state.
// This key is used to store the state of the new UI information dialog.
export const GLOBAL_VAULT_UI_ONBOARDING = new KeyDefinition<boolean>(
  VAULT_BROWSER_UI_ONBOARDING,
  "dialogState",
  {
    deserializer: (obj) => obj,
  },
);

@Injectable()
export class VaultUiOnboardingService {
  private onboardingUiReleaseDate = new Date("2024-12-10");

  private vaultUiOnboardingState: GlobalState<boolean> = this.stateProvider.getGlobal(
    GLOBAL_VAULT_UI_ONBOARDING,
  );

  private readonly vaultUiOnboardingState$ = this.vaultUiOnboardingState.state$.pipe(
    map((x) => x ?? false),
  );

  constructor(
    private stateProvider: StateProvider,
    private dialogService: DialogService,
    private apiService: ApiService,
  ) {}

  /**
   * Checks whether the onboarding dialog should be shown and opens it if necessary.
   * The dialog is shown if the user has not previously viewed it and is not a new account.
   */
  async showOnboardingDialog(): Promise<void> {
    const hasViewedDialog = await this.getVaultUiOnboardingState();

    if (!hasViewedDialog && !(await this.isNewAccount())) {
      await this.openVaultUiOnboardingDialog();
    }
  }

  private async openVaultUiOnboardingDialog(): Promise<boolean> {
    const dialogRef = VaultUiOnboardingComponent.open(this.dialogService);

    const result = firstValueFrom(dialogRef.closed);

    // Update the onboarding state when the dialog is closed
    await this.setVaultUiOnboardingState(true);

    return result;
  }

  private async isNewAccount(): Promise<boolean> {
    const userProfile = await this.apiService.getProfile();
    const profileCreationDate = new Date(userProfile.creationDate);
    return profileCreationDate > this.onboardingUiReleaseDate;
  }

  /**
   * Updates and saves the state indicating whether the user has viewed
   * the new UI onboarding information dialog.
   */
  private async setVaultUiOnboardingState(value: boolean): Promise<void> {
    await this.vaultUiOnboardingState.update(() => value);
  }

  /**
   * Retrieves the current state indicating whether the user has viewed
   * the new UI onboarding information dialog.s
   */
  private async getVaultUiOnboardingState(): Promise<boolean> {
    return await firstValueFrom(this.vaultUiOnboardingState$);
  }
}
