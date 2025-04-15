import { Component, EventEmitter, OnInit, Output } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { I18nPipe } from "@bitwarden/ui-common";
import { AccountSecurityNudgeService, SpotlightComponent } from "@bitwarden/vault";

@Component({
  selector: "vault-unlock-nudge",
  standalone: true,
  imports: [I18nPipe, SpotlightComponent],
  templateUrl: "unlock-vault-nudge.component.html",
})
export class UnlockVaultNudgeComponent implements OnInit {
  @Output() onSetPinClick = new EventEmitter<void>();
  userId: UserId | undefined = undefined;

  constructor(
    private hasAccountSecurityNudgService: AccountSecurityNudgeService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    this.userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
  }

  async handleDismiss() {
    if (this.userId) {
      await this.hasAccountSecurityNudgService.dismissNudge(this.userId);
    }
  }

  handleButtonClick() {
    this.onSetPinClick.emit();
  }
}
