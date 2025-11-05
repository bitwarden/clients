import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Inject,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { from, switchMap } from "rxjs";

import {
  ApplicationHealthReportDetail,
  ApplicationHealthReportDetailEnriched,
  OrganizationReportApplication,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { getUniqueMembers } from "@bitwarden/bit-common/dirt/reports/risk-insights/helpers";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessIntelligenceSecurityTasksService } from "../../shared/security-tasks.service";

import { AssignTasksViewComponent } from "./assign-tasks-view.component";
import { ReviewApplicationsViewComponent } from "./review-applications-view.component";

export interface NewApplicationsDialogData {
  newApplications: ApplicationHealthReportDetail[];
  /**
   * Organization ID is passed via dialog data instead of being retrieved from route params.
   * This ensures organizationId is available immediately when the dialog opens,
   * preventing async timing issues where user clicks "Mark as critical" before
   * the route subscription has fired.
   */
  organizationId: OrganizationId;
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

// Possible results for closing the dialog
export const NewApplicationsDialogResultType = Object.freeze({
  Close: "close",
  Complete: "complete",
} as const);
export type NewApplicationsDialogResultType =
  (typeof NewApplicationsDialogResultType)[keyof typeof NewApplicationsDialogResultType];

@Component({
  selector: "dirt-new-applications-dialog",
  templateUrl: "./new-applications-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    TypographyModule,
    I18nPipe,
    AssignTasksViewComponent,
    ReviewApplicationsViewComponent,
  ],
})
export class NewApplicationsDialogComponent {
  destroyRef = inject(DestroyRef);

  // View state management
  protected readonly currentView = signal<DialogView>(DialogView.SelectApplications);
  // Expose DialogView constants to template
  protected readonly DialogView = DialogView;

  // Review new applications view
  // Applications selected to save as critical applications
  protected readonly selectedApplications = signal<Set<string>>(new Set());

  // Assign tasks variables
  readonly criticalApplicationsCount = signal<number>(0);
  readonly totalApplicationsCount = signal<number>(0);
  readonly atRiskCriticalMembersCount = signal<number>(0);
  readonly saving = signal<boolean>(false);

  // Loading states
  protected readonly markingAsCritical = signal<boolean>(false);

  constructor(
    @Inject(DIALOG_DATA) protected dialogParams: NewApplicationsDialogData,
    private dialogRef: DialogRef<NewApplicationsDialogResultType>,
    private dataService: RiskInsightsDataService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private accessIntelligenceSecurityTasksService: AccessIntelligenceSecurityTasksService,
    private logService: LogService,
  ) {}

  /**
   * Opens the new applications dialog
   * @param dialogService The dialog service instance
   * @param data Dialog data containing the list of new applications and organizationId
   * @returns Dialog reference
   */
  static open(dialogService: DialogService, data: NewApplicationsDialogData) {
    return dialogService.open<boolean | undefined, NewApplicationsDialogData>(
      NewApplicationsDialogComponent,
      {
        data,
      },
    );
  }

  getApplications() {
    return this.dialogParams.newApplications;
  }

  /**
   * Toggles the selection state of an application.
   * @param applicationName The application to toggle
   */
  toggleSelection(applicationName: string) {
    this.selectedApplications.update((current) => {
      const temp = new Set(current);
      if (temp.has(applicationName)) {
        temp.delete(applicationName);
      } else {
        temp.add(applicationName);
      }
      return temp;
    });
  }

  /**
   * Toggles the selection state of all applications.
   * If all are selected, unselect all. Otherwise, select all.
   */
  toggleAll() {
    const allApplicationNames = this.dialogParams.newApplications.map((app) => app.applicationName);
    const allSelected = this.selectedApplications().size === allApplicationNames.length;

    this.selectedApplications.update(() => {
      return allSelected ? new Set() : new Set(allApplicationNames);
    });
  }

  handleMarkAsCritical() {
    if (this.markingAsCritical() || this.saving()) {
      return; // Prevent action if already processing
    }
    this.markingAsCritical.set(true);

    const onlyNewCriticalApplications = this.dialogParams.newApplications.filter((newApp) =>
      this.selectedApplications().has(newApp.applicationName),
    );

    const atRiskCriticalMembersCount = getUniqueMembers(
      onlyNewCriticalApplications.flatMap((x) => x.atRiskMemberDetails),
    ).length;
    this.atRiskCriticalMembersCount.set(atRiskCriticalMembersCount);

    this.currentView.set(DialogView.AssignTasks);
    this.markingAsCritical.set(false);
  }

  /**
   * Handles the assign tasks button click
   */
  protected handleAssignTasks() {
    if (this.saving()) {
      return; // Prevent double-click
    }
    this.saving.set(true);

    // Create updated organization report application types with new review date
    // and critical marking based on selected applications
    const newReviewDate = new Date();
    const updatedApplications: OrganizationReportApplication[] =
      this.dialogParams.newApplications.map((app) => ({
        applicationName: app.applicationName,
        isCritical: this.selectedApplications().has(app.applicationName),
        reviewedDate: newReviewDate,
      }));

    // Save the application review dates and critical markings
    this.dataService
      .saveApplicationReviewStatus(updatedApplications)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((updatedState) => {
          // After initial save is complete, created the assigned tasks
          // for at risk passwords
          const updatedStateApplicationData = updatedState?.data?.applicationData || [];
          // Manual enrich for type matching
          // TODO Consolidate in model updates
          const manualEnrichedApplications =
            updatedState?.data?.reportData.map(
              (application): ApplicationHealthReportDetailEnriched => ({
                ...application,
                isMarkedAsCritical: updatedStateApplicationData.some(
                  (a) => a.applicationName == application.applicationName && a.isCritical,
                ),
              }),
            ) || [];
          return from(
            this.accessIntelligenceSecurityTasksService.assignTasks(
              this.dialogParams.organizationId,
              manualEnrichedApplications,
            ),
          );
        }),
      )
      .subscribe({
        next: () => {
          this.toastService.showToast({
            variant: "success",
            title: this.i18nService.t("applicationReviewSaved"),
            message: this.i18nService.t("newApplicationsReviewed"),
          });
          this.saving.set(false);
          this.handleAssigningCompleted();
        },
        error: (error: unknown) => {
          this.logService.error(
            "[NewApplicationsDialog] Failed to save application review or assign tasks",
            error,
          );
          this.saving.set(false);
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorSavingReviewStatus"),
            message: this.i18nService.t("pleaseTryAgain"),
          });
        },
      });
  }

  /**
   * Closes the dialog when the "Cancel" button is selected
   */
  handleCancel() {
    this.dialogRef.close(NewApplicationsDialogResultType.Close);
  }

  /**
   * Handles the tasksAssigned event from the embedded component.
   * Closes the dialog with success indicator.
   */
  protected handleAssigningCompleted = () => {
    // Tasks were successfully assigned - close dialog
    this.dialogRef.close(NewApplicationsDialogResultType.Complete);
  };

  /**
   * Handles the back event from the embedded component.
   * Returns to the select applications view.
   */
  protected onBack = () => {
    this.currentView.set(DialogView.SelectApplications);
  };
}
