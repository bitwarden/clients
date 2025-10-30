import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { filter, map } from "rxjs/operators";

import {
  AllActivitiesService,
  RiskInsightsDataService,
  SecurityTasksApiService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AssignTasksViewComponent } from "./assign-tasks-view.component";

export interface NewApplicationsDialogData {
  newApplications: string[];
}

/**
 * View states for dialog navigation
 * Using const object pattern per ADR-0025 (Deprecate TypeScript Enums)
 */
export const DialogView = Object.freeze({
  SelectApplications: "select",
  AssignTasks: "assign",
} as const);

export type DialogView = (typeof DialogView)[keyof typeof DialogView];

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./new-applications-dialog.component.html",
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    TypographyModule,
    I18nPipe,
    AssignTasksViewComponent,
  ],
})
export class NewApplicationsDialogComponent implements OnInit {
  protected newApplications: string[] = [];
  protected selectedApplications: Set<string> = new Set<string>();

  // View state management
  protected currentView: DialogView = DialogView.SelectApplications;
  // Expose DialogView constants to template
  protected readonly DialogView = DialogView;

  // Loading states
  protected isCalculatingTasks = false;

  private destroyRef = inject(DestroyRef);
  private dialogRef = inject(DialogRef<boolean | undefined>);
  private dataService = inject(RiskInsightsDataService);
  private toastService = inject(ToastService);
  private i18nService = inject(I18nService);
  private logService = inject(LogService);
  private allActivitiesService = inject(AllActivitiesService);
  private securityTasksApiService = inject(SecurityTasksApiService);
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
  }

  /**
   * Opens the new applications dialog
   * @param dialogService The dialog service instance
   * @param data Dialog data containing the list of new applications
   * @returns Dialog reference
   */
  static open(dialogService: DialogService, data: NewApplicationsDialogData) {
    const ref = dialogService.open<boolean | undefined, NewApplicationsDialogData>(
      NewApplicationsDialogComponent,
      {
        data,
      },
    );

    // Set the component's data after opening
    const instance = ref.componentInstance as NewApplicationsDialogComponent;
    if (instance) {
      instance.newApplications = data.newApplications;
    }

    return ref;
  }

  /**
   * Toggles the selection state of an application.
   * @param applicationName The application to toggle
   */
  toggleSelection = (applicationName: string) => {
    if (this.selectedApplications.has(applicationName)) {
      this.selectedApplications.delete(applicationName);
    } else {
      this.selectedApplications.add(applicationName);
    }
  };

  /**
   * Checks if an application is currently selected.
   * @param applicationName The application to check
   * @returns True if selected, false otherwise
   */
  isSelected = (applicationName: string): boolean => {
    return this.selectedApplications.has(applicationName);
  };

  /**
   * Handles the "Mark as Critical" button click.
   * Saves review status and checks if there are tasks to assign.
   * If tasks exist, shows assign tasks view; otherwise closes dialog with success.
   */
  onMarkAsCritical = async () => {
    if (this.isCalculatingTasks) {
      return; // Prevent double-click
    }

    this.isCalculatingTasks = true;
    const selectedCriticalApps = Array.from(this.selectedApplications);

    try {
      await firstValueFrom(this.dataService.saveApplicationReviewStatus(selectedCriticalApps));

      // Check if there are tasks to assign
      if (selectedCriticalApps.length > 0) {
        const hasTasksToAssign = await this.checkForTasksToAssign();

        if (hasTasksToAssign) {
          // Transition to assign tasks view
          this.currentView = DialogView.AssignTasks;
          return; // Don't close dialog or show toast yet
        }
      }

      // No critical apps selected OR no tasks to assign - show success and close
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("applicationReviewSaved"),
        message:
          selectedCriticalApps.length > 0
            ? this.i18nService.t("applicationsMarkedAsCritical", selectedCriticalApps.length)
            : this.i18nService.t("newApplicationsReviewed"),
      });
      this.dialogRef.close(true);
    } catch {
      this.logService.error("[NewApplicationsDialog] Failed to save review status");
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorSavingReviewStatus"),
        message: this.i18nService.t("pleaseTryAgain"),
      });
    } finally {
      this.isCalculatingTasks = false;
    }
  };

  /**
   * Checks if there are tasks to assign for the selected critical applications.
   * Returns true if tasks can be assigned, false otherwise.
   */
  private async checkForTasksToAssign(): Promise<boolean> {
    try {
      const taskMetrics = await firstValueFrom(
        this.securityTasksApiService.getTaskMetrics(this.organizationId),
      );
      const atRiskPasswordsCount = await firstValueFrom(
        this.allActivitiesService.atRiskPasswordsCount$,
      );

      const canAssignTasks = atRiskPasswordsCount > taskMetrics.totalTasks;
      const newTasksCount = canAssignTasks ? atRiskPasswordsCount - taskMetrics.totalTasks : 0;

      return canAssignTasks && newTasksCount > 0;
    } catch (error) {
      this.logService.error("[NewApplicationsDialog] Failed to check for tasks", error);
      return false;
    }
  }

  /**
   * Handles the tasksAssigned event from the embedded component.
   * Closes the dialog with success indicator.
   */
  protected onTasksAssigned = () => {
    // Tasks were successfully assigned - close dialog
    this.dialogRef.close(true);
  };

  /**
   * Handles the back event from the embedded component.
   * Returns to the select applications view.
   */
  protected onBack = () => {
    this.currentView = DialogView.SelectApplications;
  };
}
