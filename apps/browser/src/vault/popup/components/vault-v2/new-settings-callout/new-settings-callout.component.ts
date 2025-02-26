import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ButtonModule, PopoverModule } from "@bitwarden/components";

import { VaultPageService } from "../vault-page.service";

@Component({
  selector: "new-settings-callout",
  templateUrl: "new-settings-callout.component.html",
  standalone: true,
  imports: [PopoverModule, JslibModule, CommonModule, ButtonModule],
  providers: [VaultPageService],
})
export class NewSettingsCalloutComponent implements OnInit, OnDestroy {
  protected showNewCustomizationSettingsCallout = false;
  protected activeUserId: UserId | null = null;

  constructor(
    private accountService: AccountService,
    private vaultProfileService: VaultProfileService,
    private vaultPageService: VaultPageService,
    private router: Router,
    private logService: LogService,
  ) {}

  async ngOnInit() {
    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    let profileCreatedDate: Date;

    try {
      profileCreatedDate = await this.vaultProfileService.getProfileCreationDate(this.activeUserId);
    } catch (e) {
      this.logService.error("Error getting profile creation date", e);
      // Default to before the cutoff date to ensure the callout is shown
      profileCreatedDate = new Date("2024-12-24");
    }

    const hasCalloutBeenDismissed = await firstValueFrom(
      this.vaultPageService.isCalloutDismissed(this.activeUserId),
    );

    this.showNewCustomizationSettingsCallout =
      !hasCalloutBeenDismissed && profileCreatedDate < new Date("2024-12-25");
  }

  async goToAppearance() {
    await this.router.navigate(["/appearance"]);
  }

  async dismissCallout() {
    if (this.activeUserId) {
      await this.vaultPageService.dismissCallout(this.activeUserId);
    }
  }

  async ngOnDestroy() {
    await this.dismissCallout();
  }
}
