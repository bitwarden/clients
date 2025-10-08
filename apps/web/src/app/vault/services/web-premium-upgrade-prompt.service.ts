import { Injectable, Optional } from "@angular/core";
import { Router } from "@angular/router";
import { Subject } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import { VaultItemDialogResult } from "../components/vault-item-dialog/vault-item-dialog.component";

@Injectable()
export class WebVaultPremiumUpgradePromptService implements PremiumUpgradePromptService {
  private readonly _upgradeConfirmed$ = new Subject<boolean>();
  readonly upgradeConfirmed$ = this._upgradeConfirmed$.asObservable();

  constructor(
    private dialogService: DialogService,
    private router: Router,
    @Optional() private dialog?: DialogRef<VaultItemDialogResult>,
  ) {}

  /**
   * Prompts the user for a premium upgrade.
   */
  async promptForPremium(organizationId?: OrganizationId) {
    let confirmed = false;
    let route: string[] | null = null;

    if (organizationId) {
      confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "upgradeOrganization" },
        content: { key: "upgradeOrganizationDesc" },
        acceptButtonText: { key: "upgradeOrganization" },
        type: "info",
      });
      if (confirmed) {
        route = ["organizations", organizationId, "billing", "subscription"];
      }
    } else {
      confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "premiumRequired" },
        content: { key: "premiumRequiredDesc" },
        acceptButtonText: { key: "upgrade" },
        type: "success",
      });
      if (confirmed) {
        route = ["settings/subscription/premium"];
      }
    }

    this._upgradeConfirmed$.next(confirmed);

    if (route) {
      await this.router.navigate(route);
    }
    if (confirmed && this.dialog) {
      this.dialog.close(VaultItemDialogResult.PremiumUpgrade);
    }
  }
}
