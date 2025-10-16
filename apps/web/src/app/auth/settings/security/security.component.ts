import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";

@Component({
  templateUrl: "security.component.html",
  imports: [SharedModule, HeaderModule],
})
export class SecurityComponent implements OnInit {
  showChangePassword = true;
  changePasswordRoute = "password";

  constructor(
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    this.showChangePassword = activeAccount
      ? await firstValueFrom(
          this.userDecryptionOptionsService.hasMasterPasswordById$(activeAccount.id),
        )
      : false;
  }
}
