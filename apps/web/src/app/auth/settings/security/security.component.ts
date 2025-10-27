import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

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
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.showChangePassword = userId
      ? await firstValueFrom(this.userDecryptionOptionsService.hasMasterPasswordById$(userId))
      : false;
  }
}
