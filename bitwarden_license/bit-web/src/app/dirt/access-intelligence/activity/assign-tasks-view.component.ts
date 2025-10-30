import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit, inject, input, output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { map, filter } from "rxjs/operators";

import {
  AllActivitiesService,
  SecurityTasksApiService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { ButtonModule, ToastService, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessIntelligenceSecurityTasksService } from "../shared/security-tasks.service";

/**
 * Embedded component for displaying task assignment UI.
 * Not a dialog - intended to be embedded within a parent dialog.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "dirt-assign-tasks-view",
  templateUrl: "./assign-tasks-view.component.html",
  imports: [CommonModule, ButtonModule, TypographyModule, I18nPipe],
})
export class AssignTasksViewComponent implements OnInit {
  /**
   * Number of applications selected as critical
   */
  readonly selectedApplicationsCount = input.required<number>();

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

  private destroyRef = inject(DestroyRef);
  private allActivitiesService = inject(AllActivitiesService);
  private securityTasksApiService = inject(SecurityTasksApiService);
  private accessIntelligenceSecurityTasksService = inject(AccessIntelligenceSecurityTasksService);
  private toastService = inject(ToastService);
  private i18nService = inject(I18nService);
  private logService = inject(LogService);
  private activatedRoute = inject(ActivatedRoute);

  private organizationId: OrganizationId = "" as OrganizationId;

  async ngOnInit(): Promise<void> {
    // Get organization ID from route params
    this.activatedRoute.paramMap
      .pipe(
        map((params) => params.get("organizationId")),
        filter((orgId): orgId is string => !!orgId),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((orgId) => {
        this.organizationId = orgId as OrganizationId;
      });

    // Calculate tasks to assign
    await this.calculateTasksToAssign();
  }

  /**
   * Calculates the number of tasks that will be assigned
   */
  private async calculateTasksToAssign(): Promise<void> {
    try {
      const taskMetrics = await firstValueFrom(
        this.securityTasksApiService.getTaskMetrics(this.organizationId),
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
      await this.accessIntelligenceSecurityTasksService.assignTasks(
        this.organizationId,
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
