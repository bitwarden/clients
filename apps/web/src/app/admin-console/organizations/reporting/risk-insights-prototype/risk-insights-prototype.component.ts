import { CommonModule } from "@angular/common";
import { Component, ChangeDetectionStrategy, DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TabsModule } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { RiskInsightsPrototypeApplicationsComponent } from "./applications/risk-insights-prototype-applications.component";
import { RiskInsightsPrototypeItemsComponent } from "./items/risk-insights-prototype-items.component";
import { RiskInsightsPrototypeMembersComponent } from "./members/risk-insights-prototype-members.component";

@Component({
  selector: "app-risk-insights-prototype",
  templateUrl: "./risk-insights-prototype.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    TabsModule,
    HeaderModule,
    RiskInsightsPrototypeItemsComponent,
    RiskInsightsPrototypeApplicationsComponent,
    RiskInsightsPrototypeMembersComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskInsightsPrototypeComponent {
  private destroyRef = inject(DestroyRef);

  tabIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ tabIndex }) => {
      this.tabIndex = !isNaN(Number(tabIndex)) ? Number(tabIndex) : 0;
    });
  }

  async onTabChange(newIndex: number): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tabIndex: newIndex },
      queryParamsHandling: "merge",
    });
  }
}
