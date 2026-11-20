import { firstValueFrom } from "rxjs";

import { callerOrganizations$ } from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { StateProvider, UserKeyDefinition } from "@bitwarden/state";
import {
  CoachmarkService,
  PAM_ACCESS_REQUESTS_TOUR_COMPLETED_KEY,
  PAM_ADMIN_TOUR_COMPLETED_KEY,
  PAM_VAULT_TOUR_COMPLETED_KEY,
  PAM_WELCOME_ACKNOWLEDGED_KEY,
  PAM_WELCOME_TOUR_COMPLETED_KEY,
  pamWelcomeTour,
} from "@bitwarden/vault";
import { PamWelcomePrompt } from "@bitwarden/web-vault/app/vault/individual-vault/vault-pam-welcome-prompt.token";


import {
  PamWelcomeDialogComponent,
  PamWelcomeDialogResult,
} from "./welcome/pam-welcome-dialog.component";

/**
 * A user who has run any PAM tour already knows their way around, so is never welcomed
 * retroactively.
 */
const TOUR_COMPLETED_KEYS: UserKeyDefinition<boolean>[] = [
  PAM_VAULT_TOUR_COMPLETED_KEY,
  PAM_ACCESS_REQUESTS_TOUR_COMPLETED_KEY,
  PAM_ADMIN_TOUR_COMPLETED_KEY,
  PAM_WELCOME_TOUR_COMPLETED_KEY,
];

/** Welcomes a member to PAM once, the first time they reach the vault with access to it. */
export class PamWelcomePromptService implements PamWelcomePrompt {
  constructor(
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private configService: ConfigService,
    private stateProvider: StateProvider,
    private dialogService: DialogService,
    private coachmarkService: CoachmarkService,
  ) {}

  async shouldPrompt(): Promise<boolean> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getOptionalUserId));
    if (userId == null) {
      return false;
    }

    if (!(await this.configService.getFeatureFlag(FeatureFlag.Pam))) {
      return false;
    }

    // `accessPam` is the caller's own entitlement; providers' is hardcoded, so they never count.
    const organizations = await firstValueFrom(
      callerOrganizations$(this.accountService, this.organizationService),
    );
    const hasPamAccess = organizations.some(
      (organization) =>
        !organization.isProviderUser && organization.usePam && organization.accessPam === true,
    );
    if (!hasPamAccess) {
      return false;
    }

    for (const key of [PAM_WELCOME_ACKNOWLEDGED_KEY, ...TOUR_COMPLETED_KEYS]) {
      if (await this.isSet(key, userId)) {
        return false;
      }
    }
    return true;
  }

  async prompt(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getOptionalUserId));
    if (userId == null) {
      return;
    }

    const result = await firstValueFrom(PamWelcomeDialogComponent.open(this.dialogService).closed);

    await this.stateProvider.setUserState(PAM_WELCOME_ACKNOWLEDGED_KEY, true, userId);

    if (result === PamWelcomeDialogResult.StartTour) {
      await this.coachmarkService.startTour(pamWelcomeTour(this.stateProvider));
    }
  }

  private async isSet(key: UserKeyDefinition<boolean>, userId: UserId): Promise<boolean> {
    return (await firstValueFrom(this.stateProvider.getUserState$(key, userId))) ?? false;
  }
}
