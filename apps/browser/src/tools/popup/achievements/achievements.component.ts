import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Subject, combineLatestWith, filter, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AchievementsListComponent } from "@bitwarden/angular/tools/achievements/achievements-list.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserEventCollector } from "@bitwarden/common/tools/log/user-event-collector";
import { EventInfo } from "@bitwarden/common/tools/log/user-event-monitor";
import { ButtonModule, IconModule } from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "achievements.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    PopOutComponent,
    ButtonModule,
    IconModule,
    AchievementsListComponent,
  ],
})
export class AchievementsComponent {
  constructor(
    private accountService: AccountService,
    private readonly collector: UserEventCollector,
  ) {
    // FIXME: add a subscription to this service and feed the data somewhere
    this.accountService.activeAccount$
      .pipe(
        filter((account): account is Account => !!account),
        map((account) => this.collector.monitor(account)),
        combineLatestWith(this._addEvent),
        takeUntilDestroyed(),
      )
      .subscribe(([capture, event]) => capture.info(event));
  }

  private _addEvent = new Subject<EventInfo>();

  addEvent() {
    this._addEvent.next({
      action: "vault-item-added",
      labels: { "vault-item-type": "login", "vault-item-uri-quantity": 1 },
      tags: ["with-attachment"],
    });
  }
}
