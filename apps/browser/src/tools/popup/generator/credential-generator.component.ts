import { AsyncPipe, CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ItemModule, TypographyModule } from "@bitwarden/components";
import { GeneratorModule } from "@bitwarden/generator-components";
import { SpotlightComponent, NudgesService, NudgeType } from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  standalone: true,
  selector: "credential-generator",
  templateUrl: "credential-generator.component.html",
  imports: [
    GeneratorModule,
    CurrentAccountComponent,
    JslibModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    PopupFooterComponent,
    RouterModule,
    ItemModule,
    SpotlightComponent,
    AsyncPipe,
    CommonModule,
    TypographyModule,
  ],
})
export class CredentialGeneratorComponent {
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
