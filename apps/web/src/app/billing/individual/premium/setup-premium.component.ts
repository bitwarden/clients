import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ButtonModule } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";

import { SetupPremiumService } from "./setup-premium.service";

@Component({
  templateUrl: "./setup-premium.component.html",
  standalone: true,
  imports: [ButtonModule],
})
export class SetupPremiumComponent implements OnInit {
  userId: UserId;

  constructor(
    private accountService: AccountService,
    private router: Router,
    private setupPremiumService: SetupPremiumService,
  ) {}

  async ngOnInit(): Promise<void> {
    const currentAcct = await firstValueFrom(this.accountService.activeAccount$);
    this.userId = currentAcct.id;
  }

  async clickSetup() {
    // Insert logic for setting up premium...

    await this.setupPremiumService.clearIntentToSetupPremium(this.userId);
    await this.router.navigate(["/vault"]);
  }

  async clickMaybeLater() {
    await this.setupPremiumService.clearIntentToSetupPremium(this.userId);
    await this.router.navigate(["/vault"]);
  }
}
