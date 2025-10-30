import { CommonModule } from "@angular/common";
import { Component, OnInit, inject, input, output } from "@angular/core";
import { firstValueFrom } from "rxjs";

import {
  AllActivitiesService,
  SecurityTasksApiService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { ButtonModule, ToastService, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DefaultAdminTaskService } from "../../../vault/services/default-admin-task.service";
import { AccessIntelligenceSecurityTasksService } from "../shared/security-tasks.service";

/**
 * Embedded component for displaying task assignment UI.
 * Not a dialog - intended to be embedded within a parent dialog.
 *
 * Important: This component provides its own instances of AccessIntelligenceSecurityTasksService
 * and DefaultAdminTaskService. These services are scoped to this component to ensure proper
 * dependency injection when the component is dynamically rendered within the dialog.
 * Without these providers, Angular would throw NullInjectorError when trying to inject
 * DefaultAdminTaskService, which is required by AccessIntelligenceSecurityTasksService.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "dirt-assign-tasks-view",
  templateUrl: "./assign-tasks-view.component.html",
  imports: [CommonModule, ButtonModule, TypographyModule, I18nPipe],
  providers: [AccessIntelligenceSecurityTasksService, DefaultAdminTaskService],
})
export class AssignTasksViewComponent implements OnInit {
  /**
   * Number of applications selected as critical
   */
  readonly selectedApplicationsCount = input.required<number>();

  /**
   * Organization ID - passed from parent instead of reading from route
   * because this component is embedded in a dialog and doesn't have direct route access
   */
  readonly organizationId = input.required<OrganizationId>();

  /**
   * Emitted when tasks have been successfully assigned
   */
  readonly tasksAssigned = output<void>();

  /**
   * Emitted when user clicks Back button
   */
  readonly back = output<void>();

  protected totalTasksToAssign = 0;
  protected isAssigning = false;

  private allActivitiesService = inject(AllActivitiesService);
  private securityTasksApiService = inject(SecurityTasksApiService);
  private accessIntelligenceSecurityTasksService = inject(AccessIntelligenceSecurityTasksService);
  private toastService = inject(ToastService);
  private i18nService = inject(I18nService);
  private logService = inject(LogService);

  async ngOnInit(): Promise<void> {
    // Calculate tasks to assign using organizationId passed from parent
    await this.calculateTasksToAssign();
  }

  /**
   * Calculates the number of tasks that will be assigned.
   * Uses the same logic as password-change-metric.component.ts
   */
  private async calculateTasksToAssign(): Promise<void> {
    try {
      const taskMetrics = await firstValueFrom(
        this.securityTasksApiService.getTaskMetrics(this.organizationId()),
      );
      const atRiskPasswordsCount = await firstValueFrom(
        this.allActivitiesService.atRiskPasswordsCount$,
      );

      const newTasksCount = atRiskPasswordsCount - taskMetrics.totalTasks;
      this.totalTasksToAssign = newTasksCount > 0 ? newTasksCount : 0;
    } catch (error) {
      this.logService.error("[AssignTasksView] Failed to calculate tasks", error);
      this.totalTasksToAssign = 0;
    }
  }

  /**
   * Handles the assign tasks button click
   */
  protected onAssignTasks = async () => {
    if (this.isAssigning) {
      return; // Prevent double-click
    }

    this.isAssigning = true;

    try {
      // Get critical applications details
      const allApplicationsDetails = await firstValueFrom(
        this.allActivitiesService.allApplicationsDetails$,
      );

      // Filter to only critical apps
      const criticalApps = allApplicationsDetails.filter((app) => app.isMarkedAsCritical);

      // Assign tasks using the security tasks service
      // Uses the same logic as password-change-metric.component.ts
      await this.accessIntelligenceSecurityTasksService.assignTasks(
        this.organizationId(),
        criticalApps,
      );

      // Success toast is shown by the service
      // Emit success event to parent
      this.tasksAssigned.emit();
    } catch (error) {
      this.logService.error("[AssignTasksView] Failed to assign tasks", error);
      // Error toast is shown by the service
      this.isAssigning = false; // Re-enable button on error
    }
  };

  /**
   * Handles the back button click
   */
  protected onBack = () => {
    this.back.emit();
  };
}
