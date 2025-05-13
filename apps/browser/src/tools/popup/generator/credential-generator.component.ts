import { AsyncPipe, CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom, map, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ItemModule, TypographyModule } from "@bitwarden/components";
import { GeneratorModule } from "@bitwarden/generator-components";
import { SpotlightComponent, VaultNudgesService, VaultNudgeType } from "@bitwarden/vault";

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
  protected readonly VaultNudgeType = VaultNudgeType;
  private activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);
  protected showGeneratorSpotlight$: Observable<boolean> = this.activeUserId$.pipe(
    switchMap((userId) =>
      this.vaultNudgesService.showNudge$(VaultNudgeType.GeneratorNudgeStatus, userId),
    ),
    map((nudgeStatus) => !nudgeStatus.hasSpotlightDismissed),
  );

  constructor(
    private vaultNudgesService: VaultNudgesService,
    private i18nService: I18nService,
    private accountService: AccountService,
  ) {}

  async dismissGeneratorSpotlight(type: VaultNudgeType) {
    const activeUserId = await firstValueFrom(this.activeUserId$);

    await this.vaultNudgesService.dismissNudge(type, activeUserId as UserId);
  }
}
