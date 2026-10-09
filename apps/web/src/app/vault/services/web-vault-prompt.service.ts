import { inject, Injectable } from "@angular/core";
import { map, switchMap, combineLatest, zip, first, firstValueFrom } from "rxjs";

import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { NewExperienceDialogService, VaultItemsTransferService } from "@bitwarden/vault";

import {
  AutoConfirmPolicy,
  MultiStepPolicyEditModalComponent,
} from "../../admin-console/organizations/policies";
import { UnifiedUpgradePromptService } from "../../billing/individual/upgrade/services";

import { WebVaultExtensionPromptService } from "./web-vault-extension-prompt.service";
import { WelcomeDialogService } from "./welcome-dialog.service";

/**
 * Screenshots of the redesigned vault, shown in the new experience dialog. Relative to the
 * document, which webpack emits alongside the copied `images` directory.
 */
const NEW_EXPERIENCE_LIGHT_IMG = "images/new-experience/new-experience.light.png";
const NEW_EXPERIENCE_DARK_IMG = "images/new-experience/new-experience.dark.png";

@Injectable()
export class WebVaultPromptService {
  private unifiedUpgradePromptService = inject(UnifiedUpgradePromptService);
  private vaultItemTransferService = inject(VaultItemsTransferService);
  private policyService = inject(PolicyService);
  private accountService = inject(AccountService);
  private configService = inject(ConfigService);
  private autoConfirmService = inject(AutomaticUserConfirmationService);
  private organizationService = inject(OrganizationService);
  private dialogService = inject(DialogService);
  private logService = inject(LogService);
  private webVaultExtensionPromptService = inject(WebVaultExtensionPromptService);
  private welcomeDialogService = inject(WelcomeDialogService);
  private newExperienceDialogService = inject(NewExperienceDialogService);

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

    await this.vaultItemTransferService.enforceOrganizationDataOwnership(userId);

    this.checkForAutoConfirm();

    const serverSettings = await firstValueFrom(this.configService.serverSettings$);
    if (serverSettings?.suppressOnboardingInterstitials) {
      return;
    }

    if (await this.unifiedUpgradePromptService.displayUpgradePromptConditionally()) {
      return;
    }

    // A user who was just welcomed to Bitwarden is not also told what changed about it.
    if (await this.welcomeDialogService.conditionallyShowWelcomeDialog()) {
      return;
    }

    const newExperienceResult = await this.newExperienceDialogService.conditionallyOpen(userId, {
      lightImgSrc: NEW_EXPERIENCE_LIGHT_IMG,
      darkImgSrc: NEW_EXPERIENCE_DARK_IMG,
    });
    if (newExperienceResult !== null) {
      return;
    }

    await this.webVaultExtensionPromptService.conditionallyPromptUserForExtension(userId);
  }

  private openAutoConfirmFeatureDialog(organization: Organization) {
    // Opened as a modal (not a drawer) - this is a proactive onboarding prompt shown on the
    // vault page, not a policy being edited from the Admin Console policies page, so it should
    // remain an attention-grabbing modal rather than a side drawer.
    MultiStepPolicyEditModalComponent.open(this.dialogService, {
      data: {
        policy: new AutoConfirmPolicy(true),
        organization: organization,
      },
    });
  }

  private checkForAutoConfirm() {
    // if the policy is enabled, then the user may only belong to one organization at most.
    const organization$ = this.organizations$.pipe(map((organizations) => organizations[0]));

    const autoConfirmState$ = this.userId$.pipe(
      switchMap((userId) => this.autoConfirmService.configuration$(userId)),
    );

    const policyEnabled$ = combineLatest([
      this.userId$.pipe(
        switchMap((userId) => this.policyService.policies$(userId)),
        map((policies) =>
          policies.find((p) => p.type === PolicyType.AutomaticUserConfirmation && p.enabled),
        ),
      ),
      organization$,
    ]).pipe(
      map(
        ([policy, organization]) => (policy && policy.organizationId === organization?.id) ?? false,
      ),
    );

    zip([organization$, autoConfirmState$, policyEnabled$, this.userId$])
      .pipe(
        first(),
        switchMap(async ([organization, autoConfirmState, policyEnabled, userId]) => {
          const showDialog =
            !policyEnabled &&
            autoConfirmState.showSetupDialog &&
            !!organization &&
            organization.canEnableAutoConfirmPolicy;

          if (showDialog) {
            this.openAutoConfirmFeatureDialog(organization);

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
