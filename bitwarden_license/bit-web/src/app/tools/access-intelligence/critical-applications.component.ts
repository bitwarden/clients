// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { debounceTime, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SearchModule, TableDataSource, NoItemsModule, Icons } from "@bitwarden/components";
import { CardComponent } from "@bitwarden/tools-card";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { applicationTableMockData } from "./application-table.mock";
import { RiskInsightsTabType } from "./risk-insights.component";

@Component({
  standalone: true,
  selector: "tools-critical-applications",
  templateUrl: "./critical-applications.component.html",
  imports: [CardComponent, HeaderModule, SearchModule, NoItemsModule, PipesModule, SharedModule],
})
export class CriticalApplicationsComponent implements OnInit {
  protected dataSource = new TableDataSource<any>();
  protected selectedIds: Set<number> = new Set<number>();
  protected searchControl = new FormControl("", { nonNullable: true });
  private destroyRef = inject(DestroyRef);
  protected loading = false;
  protected organizationId: string;
  noItemsIcon = Icons.Security;
  // MOCK DATA
  protected mockData = applicationTableMockData;
  protected mockAtRiskMembersCount = 0;
  protected mockAtRiskAppsCount = 0;
  protected mockTotalMembersCount = 0;
  protected mockTotalAppsCount = 0;

  ngOnInit() {
    this.activatedRoute.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(async (params) => {
          this.organizationId = params.get("organizationId");
          // TODO: use organizationId to fetch data
        }),
      )
      .subscribe();
  }

  goToAllAppsTab = async () => {
    await this.router.navigate([`organizations/${this.organizationId}/risk-insights`], {
      queryParams: { tabIndex: RiskInsightsTabType.AllApps },
      queryParamsHandling: "merge",
    });
  };

  constructor(
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected router: Router,
  ) {
    this.dataSource.data = []; //applicationTableMockData;
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }
}
