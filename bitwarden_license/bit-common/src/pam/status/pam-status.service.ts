import { firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

/** The values of the two PAM feature flags as this client sees them. */
export interface PamFeatureFlagStatus {
  pam: boolean;
  pamAccessConnector: boolean;
}

/**
 * What the caller's synced organization says about PAM. The `can*` fields are client-side hints
 * computed from the synced organization and role; the server is authoritative.
 */
export interface PamOrganizationStatus {
  id: string;
  usePam: boolean;
  accessPam: boolean;
  isProviderUser: boolean;
  hasProvider: boolean;
  providerType?: number;
  canManageAccessRules: boolean;
  canManageRotation: boolean;
  canAccessEventLogs: boolean;
  canAccessReports: boolean;
}

export interface PamStatus {
  flags: PamFeatureFlagStatus;
  /** Whether a user is logged in. Without one, `organizations` is empty. */
  loggedIn: boolean;
  organizations: PamOrganizationStatus[];
}

/**
 * Reports PAM readiness. It makes no SDK call and no request: feature flags come from the server
 * config the client already holds, and organizations from the synced state. It needs neither the
 * PAM flag nor an unlocked vault, so it can explain why other `bw privileged-controls` commands refuse.
 */
export class PamStatusService {
  constructor(
    private configService: ConfigService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  /** @param organizationId When given, only that organization is reported (empty if not a member). */
  async getStatus(organizationId?: string): Promise<PamStatus> {
    const flags: PamFeatureFlagStatus = {
      pam: await this.flag(FeatureFlag.Pam),
      pamAccessConnector: await this.flag(FeatureFlag.PamAccessConnector),
    };

    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (userId == null) {
      return { flags, loggedIn: false, organizations: [] };
    }

    const organizations = await firstValueFrom(this.organizationService.organizations$(userId));
    return {
      flags,
      loggedIn: true,
      organizations: organizations
        .filter((o) => organizationId == null || o.id === organizationId)
        .map((o) => ({
          id: o.id,
          usePam: o.usePam,
          accessPam: o.accessPam,
          isProviderUser: o.isProviderUser,
          hasProvider: o.hasProvider,
          providerType: o.providerType,
          canManageAccessRules: o.canManageAccessRules,
          canManageRotation: o.canManageRotation,
          canAccessEventLogs: o.canAccessEventLogs,
          canAccessReports: o.canAccessReports,
        })),
    };
  }

  private async flag(flag: FeatureFlag): Promise<boolean> {
    return (await firstValueFrom(this.configService.getFeatureFlag$(flag))) === true;
  }
}
