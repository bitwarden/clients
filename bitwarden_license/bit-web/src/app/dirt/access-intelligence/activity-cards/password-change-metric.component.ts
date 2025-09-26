import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subject, switchMap, takeUntil, of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SecurityTasksApiService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { ButtonModule, ProgressModule, TypographyModule } from "@bitwarden/components";

@Component({
  selector: "dirt-password-change-metric",
  imports: [CommonModule, TypographyModule, JslibModule, ProgressModule, ButtonModule],
  templateUrl: "./password-change-metric.component.html",
})
export class PasswordChangeMetricComponent implements OnInit {
  totalTasks: number = 0;
  completedTasks: number = 0;
  private organizationId!: OrganizationId;
  private destroyRef = new Subject<void>();

  async ngOnInit(): Promise<void> {
    this.activatedRoute.paramMap
      .pipe(
        switchMap((paramMap) => {
          const orgId = paramMap.get("organizationId");
          if (orgId) {
            this.organizationId = orgId as OrganizationId;
            return this.securityTasksApiService.getTaskMetrics(this.organizationId);
          }
          return of({ totalTasks: 0, completedTasks: 0 });
        }),
        takeUntil(this.destroyRef),
      )
      .subscribe((metrics) => {
        this.totalTasks = metrics.totalTasks;
        this.completedTasks = metrics.completedTasks;
      });
  }

  constructor(
    private activatedRoute: ActivatedRoute,
    private securityTasksApiService: SecurityTasksApiService,
  ) {}

  get completedPercent(): number {
    return Math.round((this.completedTasks / this.totalTasks) * 100);
  }
}
