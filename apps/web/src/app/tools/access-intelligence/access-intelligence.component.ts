import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TabsModule } from "@bitwarden/components";

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

  apps: any[] = [];
  priorityApps: any[] = [];
  notifiedMembers: any[] = [];

  constructor(route: ActivatedRoute) {
    route.queryParams.pipe(takeUntilDestroyed(), first()).subscribe(({ tabIndex }) => {
      this.tabIndex = !isNaN(tabIndex) ? tabIndex : AccessIntelligenceTabType.AllApps;
    });
  }
}
