import { inject, Injectable } from "@angular/core";
import { map, switchMap, combineLatest, zip, first, lastValueFrom, firstValueFrom } from "rxjs";

import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogRef, DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { VaultItemsTransferService } from "@bitwarden/vault";

import {
  AutoConfirmPolicyDialogComponent,
  AutoConfirmPolicy,
  PolicyEditDialogResult,
} from "../../admin-console/organizations/policies";
import { UnifiedUpgradePromptService } from "../../billing/individual/upgrade/services";

@Injectable()
export class WebVaultOnboardingService {
  private unifiedUpgradePromptService = inject(UnifiedUpgradePromptService);
  private vaultItemTransferService = inject(VaultItemsTransferService);
  private policyService = inject(PolicyService);
  private accountService = inject(AccountService);
  private autoConfirmService = inject(AutomaticUserConfirmationService);
  private organizationService = inject(OrganizationService);
  private configService = inject(ConfigService);
  private dialogService = inject(DialogService);
  private logService = inject(LogService);

  private userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private organizations$ = this.userId$.pipe(
    switchMap((id) => this.organizationService.organizations$(id)),
  );

  private autoConfirmDialogRef?: DialogRef<PolicyEditDialogResult> | undefined;

  /**
   * Conditionally initiates the onboarding process for a new user.
   * All logic for new users should be handled within this method to avoid
   * the user seeing multiple onboarding prompts at different times.
   */
  async conditionallyInitiateOnboarding() {
    const userId = await firstValueFrom(this.userId$);

    void this.unifiedUpgradePromptService.displayUpgradePromptConditionally();

    this.setupAutoConfirm();

    void this.vaultItemTransferService.enforceOrganizationDataOwnership(userId);
  }

  private async openAutoConfirmFeatureDialog(organization: Organization) {
    if (this.autoConfirmDialogRef) {
      return;
    }

    this.autoConfirmDialogRef = AutoConfirmPolicyDialogComponent.open(this.dialogService, {
      data: {
        policy: new AutoConfirmPolicy(),
        organizationId: organization.id,
        firstTimeDialog: true,
      },
    });

    await lastValueFrom(this.autoConfirmDialogRef.closed);
    this.autoConfirmDialogRef = undefined;
  }

  private setupAutoConfirm() {
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
