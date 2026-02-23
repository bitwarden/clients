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
import { VaultItemsTransferService } from "@bitwarden/vault";

import {
  AutoConfirmPolicyDialogComponent,
  AutoConfirmPolicy,
} from "../../admin-console/organizations/policies";
import { UnifiedUpgradePromptService } from "../../billing/individual/upgrade/services";

import { WebVaultExtensionPromptService } from "./web-vault-extension-prompt.service";
import { WelcomeDialogService } from "./welcome-dialog.service";

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
  private webVaultExtensionPromptService = inject(WebVaultExtensionPromptService);
  private welcomeDialogService = inject(WelcomeDialogService);

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

    await this.vaultItemTransferService.enforceOrganizationDataOwnership(userId);

    await this.welcomeDialogService.conditionallyShowWelcomeDialog();

    await this.webVaultExtensionPromptService.conditionallyPromptUserForExtension(userId);

    this.checkForAutoConfirm();
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
