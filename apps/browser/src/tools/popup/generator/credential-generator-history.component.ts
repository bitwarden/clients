// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { pin } from "@bitwarden/common/tools/rx";
import { ButtonModule, ContainerComponent, DialogService } from "@bitwarden/components";
import {
  CredentialGeneratorHistoryComponent as CredentialGeneratorHistoryToolsComponent,
  EmptyCredentialHistoryComponent,
} from "@bitwarden/generator-components";
import { GeneratorHistoryService } from "@bitwarden/generator-history";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  selector: "app-credential-generator-history",
  templateUrl: "credential-generator-history.component.html",
  standalone: true,
  imports: [
    ButtonModule,
    CommonModule,
    ContainerComponent,
    JslibModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    CredentialGeneratorHistoryToolsComponent,
    EmptyCredentialHistoryComponent,
    PopupFooterComponent,
  ],
})
export class CredentialGeneratorHistoryComponent {
  protected readonly hasHistory$ = new BehaviorSubject<boolean>(false);
  protected readonly account$ = new BehaviorSubject<Account>(null);

  constructor(
    private accountService: AccountService,
    private history: GeneratorHistoryService,
    private dialogService: DialogService,
  ) {
    this.accountService.activeAccount$
      .pipe(
        pin({
          name: () => "browser credential-generator-history.component",
          distinct: (p, c) => p.id === c.id,
        }),
        takeUntilDestroyed(),
      )
      .subscribe(this.account$);
  }

  clear = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "clearGeneratorHistoryTitle" },
      content: { key: "cleargGeneratorHistoryDescription" },
      type: "warning",
      acceptButtonText: { key: "clearHistory" },
      cancelButtonText: { key: "cancel" },
    });

    if (confirmed) {
      await this.history.clear((await firstValueFrom(this.account$)).id);
    }
  };
}
