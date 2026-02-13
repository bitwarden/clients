import { inject, Injectable } from "@angular/core";
import { map, switchMap, combineLatest, zip, first, firstValueFrom } from "rxjs";

import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { StateProvider, UserKeyDefinition, VAULT_WELCOME_DIALOG_DISK } from "@bitwarden/state";
import { VaultItemsTransferService } from "@bitwarden/vault";

import {
  AutoConfirmPolicyDialogComponent,
  AutoConfirmPolicy,
} from "../../admin-console/organizations/policies";
import { UnifiedUpgradePromptService } from "../../billing/individual/upgrade/services";
import { VaultWelcomeDialogComponent } from "../components/vault-welcome-dialog/vault-welcome-dialog.component";

const VAULT_WELCOME_DIALOG_ACKNOWLEDGED_KEY = new UserKeyDefinition<boolean>(
  VAULT_WELCOME_DIALOG_DISK,
  "vaultWelcomeDialogAcknowledged",
  {
    deserializer: (value) => value,
    clearOn: [],
  },
);

const THIRTY_DAY_MS = 1000 * 60 * 60 * 24 * 30;

@Injectable()
export class WebVaultPromptService {
  private unifiedUpgradePromptService = inject(UnifiedUpgradePromptService);
  private vaultItemTransferService = inject(VaultItemsTransferService);
  private policyService = inject(PolicyService);
  private accountService = inject(AccountService);
  private autoConfirmService = inject(AutomaticUserConfirmationService);
  private organizationService = inject(OrganizationService);
  private configService = inject(ConfigService);
  private dialogService = inject(DialogService);
  private logService = inject(LogService);
  private stateProvider = inject(StateProvider);

  private userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private organizations$ = this.userId$.pipe(
    switchMap((id) => this.organizationService.organizations$(id)),
  );

  /**
   * Conditionally initiates prompts for users.
   * All logic for users should be handled within this method to avoid
   * the user seeing multiple onboarding prompts at different times.
   */
  async conditionallyPromptUser() {
    const userId = await firstValueFrom(this.userId$);

    if (await this.unifiedUpgradePromptService.displayUpgradePromptConditionally()) {
      return;
    }

    void this.vaultItemTransferService.enforceOrganizationDataOwnership(userId);

    if (await this.conditionallyShowWelcomeDialog()) {
      return;
    }

    this.checkForAutoConfirm();
  }

  async conditionallyShowWelcomeDialog(): Promise<boolean> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return false;
    }

    const enabled = await this.configService.getFeatureFlag(FeatureFlag.PM29437_WelcomeDialog);
    if (!enabled) {
      return false;
    }

    const createdAt = account.creationDate;
    if (!createdAt) {
      return false;
    }

    const ageMs = Date.now() - createdAt.getTime();
    const isNewUser = ageMs >= 0 && ageMs <= THIRTY_DAY_MS;
    if (!isNewUser) {
      return false;
    }

    const acknowledged = await firstValueFrom(
      this.stateProvider
        .getUserState$(VAULT_WELCOME_DIALOG_ACKNOWLEDGED_KEY, account.id)
        .pipe(map((v) => v ?? false)),
    );

    if (acknowledged) {
      return false;
    }

    const dialogRef = VaultWelcomeDialogComponent.open(this.dialogService);
    await firstValueFrom(dialogRef.closed);

    await this.stateProvider.setUserState(VAULT_WELCOME_DIALOG_ACKNOWLEDGED_KEY, true, account.id);
    return true;
  }

  private async openAutoConfirmFeatureDialog(organization: Organization) {
    AutoConfirmPolicyDialogComponent.open(this.dialogService, {
      data: {
        policy: new AutoConfirmPolicy(),
        organizationId: organization.id,
        firstTimeDialog: true,
      },
    });
  }

  private checkForAutoConfirm() {
    // if the policy is enabled, then the user may only belong to one organization at most.
    const organization$ = this.organizations$.pipe(map((organizations) => organizations[0]));

    const featureFlag$ = this.configService.getFeatureFlag$(FeatureFlag.AutoConfirm);

    const autoConfirmState$ = this.userId$.pipe(
      switchMap((userId) => this.autoConfirmService.configuration$(userId)),
    );

    const policyEnabled$ = combineLatest([
      this.userId$.pipe(
        switchMap((userId) => this.policyService.policies$(userId)),
        map((policies) => policies.find((p) => p.type === PolicyType.AutoConfirm && p.enabled)),
      ),
      organization$,
    ]).pipe(
      map(
        ([policy, organization]) => (policy && policy.organizationId === organization?.id) ?? false,
      ),
    );

    zip([organization$, featureFlag$, autoConfirmState$, policyEnabled$, this.userId$])
      .pipe(
        first(),
        switchMap(async ([organization, flagEnabled, autoConfirmState, policyEnabled, userId]) => {
          const showDialog =
            flagEnabled &&
            !policyEnabled &&
            autoConfirmState.showSetupDialog &&
            !!organization &&
            organization.canEnableAutoConfirmPolicy;

          if (showDialog) {
            await this.openAutoConfirmFeatureDialog(organization);

            await this.autoConfirmService.upsert(userId, {
              ...autoConfirmState,
              showSetupDialog: false,
            });
          }
        }),
      )
      .subscribe({
        error: (err: unknown) => this.logService.error("Failed to update auto-confirm state", err),
      });
  }
}
