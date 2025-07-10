import { AsyncPipe, CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { firstValueFrom, Observable, switchMap } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { SpotlightComponent } from "@bitwarden/angular/vault/components/spotlight/spotlight.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "nudge-generator-spotlight",
  templateUrl: "nudge-generator-spotlight.component.html",
  imports: [I18nPipe, SpotlightComponent, AsyncPipe, CommonModule, TypographyModule],
})
export class NudgeGeneratorSpotlightComponent {
  protected readonly NudgeType = NudgeType;
  private activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);
  protected showGeneratorSpotlight$: Observable<boolean> = this.activeUserId$.pipe(
    switchMap((userId) =>
      this.nudgesService.showNudgeSpotlight$(NudgeType.GeneratorNudgeStatus, userId),
    ),
  );

  constructor(
    private nudgesService: NudgesService,
    private accountService: AccountService,
  ) {}

  async dismissGeneratorSpotlight(type: NudgeType) {
    const activeUserId = await firstValueFrom(this.activeUserId$);

    await this.nudgesService.dismissNudge(type, activeUserId as UserId);
  }
}
