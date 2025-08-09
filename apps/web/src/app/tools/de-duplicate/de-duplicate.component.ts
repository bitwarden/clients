import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ButtonModule, CalloutModule } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";
import { DeDuplicateService } from "../../vault/services/de-duplicate.service";


@Component({
  selector: "app-de-duplicate",
  standalone: true,
  imports: [CommonModule, SharedModule, HeaderModule, ButtonModule, CalloutModule],
  templateUrl: "./de-duplicate.component.html",
})
export class DeDuplicateComponent {
  loading = false;
  message: string;

  constructor(
    @Inject(DeDuplicateService) private deDuplicateService: DeDuplicateService,
    private accountService: AccountService,
  ) {}

  async findDuplicates() {
    this.loading = true;
    this.message = null;

    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const setCount = await this.deDuplicateService.findAndHandleDuplicates(userId);
      if (setCount === 0) {
        this.message = "No duplicate login items were found.";
      } else if (setCount === 1) {
        this.message = "1 duplicate set found (reviewed).";
      } else {
        this.message = `${setCount} duplicate sets found (reviewed).`;
      }
    } catch (e) {
      this.message = `An error occurred: ${e.message}`;
    } finally {
      this.loading = false;
    }
  }
}
