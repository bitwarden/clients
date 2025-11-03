import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import {
  ButtonModule,
  CalloutComponent,
  IconTileComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { DarkImageSourceDirective } from "@bitwarden/vault";

import { DefaultAdminTaskService } from "../../../../vault/services/default-admin-task.service";
import { AccessIntelligenceSecurityTasksService } from "../../shared/security-tasks.service";

/**
 * Embedded component for displaying task assignment UI.
 * Not a dialog - intended to be embedded within a parent dialog.
 *
 * Important: This component provides its own instances of AccessIntelligenceSecurityTasksService
 * and DefaultAdminTaskService. These services are scoped to this component to ensure proper
 * dependency injection when the component is dynamically rendered within the structure.
 * Without these providers, Angular would throw NullInjectorError when trying to inject
 * DefaultAdminTaskService, which is required by AccessIntelligenceSecurityTasksService.
 */
@Component({
  selector: "dirt-assign-tasks-view",
  templateUrl: "./assign-tasks-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonModule,
    TypographyModule,
    I18nPipe,
    IconTileComponent,
    DarkImageSourceDirective,
    CalloutComponent,
  ],
  providers: [AccessIntelligenceSecurityTasksService, DefaultAdminTaskService],
})
export class AssignTasksViewComponent {
  readonly criticalApplicationsCount = input.required<number>();
  readonly totalApplicationsCount = input.required<number>();
  readonly atRiskCriticalMembersCount = input.required<number>();

  // async ngOnInit(): Promise<void> {
  //   // Get unique members with at-risk passwords and total applications from report summary
  //   // Uses the same pattern as all-activity.component.ts
  //   // await this.loadReportSummary();
  // }

  // /**
  //  * Loads the count of unique members with at-risk passwords and total applications.
  //  * Uses the same pattern as all-activity.component.ts
  //  */
  // private async loadReportSummary(): Promise<void> {
  //   try {
  //     const summary = await firstValueFrom(this.allActivitiesService.reportSummary$);
  //     this.criticalAppsAtRiskMemberCount = summary.totalCriticalAtRiskMemberCount;
  //     this.totalApplicationsCount = summary.totalApplicationCount;
  //   } catch (error) {
  //     this.logService.error("[AssignTasksView] Failed to load report summary", error);
  //     this.criticalAppsAtRiskMemberCount = 0;
  //     this.totalApplicationsCount = 0;
  //   }
  // }
}
