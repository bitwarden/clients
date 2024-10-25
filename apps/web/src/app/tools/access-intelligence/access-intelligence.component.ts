import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AsyncActionsModule, ButtonModule, TabsModule } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";

import { ApplicationTableComponent } from "./application-table.component";
import { NotifiedMembersTableComponent } from "./notified-members-table.component";
import { PasswordHealthMembersComponent } from "./password-health-members.component";
import { PasswordHealthComponent } from "./password-health.component";

export enum AccessIntelligenceTabType {
  AllApps = 0,
  PriorityApps = 1,
  NotifiedMembers = 2,
}

@Component({
  standalone: true,
  templateUrl: "./access-intelligence.component.html",
  imports: [
    ApplicationTableComponent,
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    JslibModule,
    HeaderModule,
    PasswordHealthComponent,
    PasswordHealthMembersComponent,
    NotifiedMembersTableComponent,
    TabsModule,
  ],
})
export class AccessIntelligenceComponent {
  tabIndex: AccessIntelligenceTabType;
  dataLastUpdated = new Date();

  apps: any[] = [];
  priorityApps: any[] = [];
  notifiedMembers: any[] = [];

  async refreshData() {
    // TODO: Implement
    return new Promise((resolve) =>
      setTimeout(() => {
        this.dataLastUpdated = new Date();
        resolve(true);
      }, 1000),
    );
  }

  constructor(route: ActivatedRoute) {
    route.queryParams.pipe(takeUntilDestroyed(), first()).subscribe(({ tabIndex }) => {
      this.tabIndex = !isNaN(tabIndex) ? tabIndex : AccessIntelligenceTabType.AllApps;
    });
  }
}
