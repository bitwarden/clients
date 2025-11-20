import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Inject,
  inject,
  Injector,
  Signal,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { from, switchMap, take } from "rxjs";

import {
  ApplicationHealthReportDetail,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { getUniqueMembers } from "@bitwarden/bit-common/dirt/reports/risk-insights/helpers";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskStatus } from "@bitwarden/common/vault/tasks";
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

import { CipherIcon } from "../../shared/app-table-row-scrollable.component";
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
  /**
   * Whether the organization has any existing critical applications.
   * Used to determine which title and description to show in the dialog.
   */
  hasExistingCriticalApplications: boolean;
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-new-applications-dialog",
  templateUrl: "./new-applications-dialog.component.html",
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

  readonly applicationIcons = signal<Map<string, CipherIcon>>(new Map<string, CipherIcon>());

  // Used to determine if there are unassigned at-risk cipher IDs
  private readonly _tasks!: Signal<SecurityTask[]>;

  // Computed properties for selected applications
  protected readonly newCriticalApplications = computed(() => {
    return this.dialogParams.newApplications.filter((newApp) =>
      this.selectedApplications().has(newApp.applicationName),
    );
  });

  // New at risk critical applications
  protected readonly newAtRiskCriticalApplications = computed(() => {
    return this.newCriticalApplications().filter((app) => app.atRiskPasswordCount > 0);
  });

  // Count of unique members with at-risk passwords in newly marked critical applications
  protected readonly atRiskCriticalMembersCount = computed(() => {
    return getUniqueMembers(this.newCriticalApplications().flatMap((x) => x.atRiskMemberDetails))
      .length;
  });

  protected readonly newUnassignedAtRiskCipherIds = computed<CipherId[]>(() => {
    const newAtRiskCipherIds = this.newCriticalApplications().flatMap((app) => app.atRiskCipherIds);
    const tasks = this._tasks();

    if (tasks.length === 0) {
      return newAtRiskCipherIds;
    }

    const inProgressTasks = tasks.filter((task) => task.status === SecurityTaskStatus.Pending);
    const assignedIdSet = new Set(inProgressTasks.map((task) => task.cipherId));
    const unassignedIds = newAtRiskCipherIds.filter((id) => !assignedIdSet.has(id));
    return unassignedIds;
  });

  readonly saving = signal<boolean>(false);

  // Loading states
  protected readonly markingAsCritical = signal<boolean>(false);

  constructor(
    @Inject(DIALOG_DATA) protected dialogParams: NewApplicationsDialogData,
    private dataService: RiskInsightsDataService,
    private dialogRef: DialogRef<NewApplicationsDialogResultType>,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private injector: Injector,
    private logService: LogService,
    private securityTasksService: AccessIntelligenceSecurityTasksService,
    private toastService: ToastService,
  ) {
    this.setApplicationsWithIcons(this.dialogParams.newApplications);
    // Setup the _tasks signal by manually passing in the injector
    this._tasks = toSignal(this.securityTasksService.tasks$, {
      initialValue: [],
      injector: this.injector,
    });
  }

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

  getApplicationsWithIcons(): Array<ApplicationHealthReportDetail & { iconCipher: CipherIcon }> {
    return this.dialogParams.newApplications.map((app) => {
      const iconCipher = this.applicationIcons().get(app.applicationName);
      return {
        ...app,
        iconCipher,
      } as ApplicationHealthReportDetail & { iconCipher: CipherIcon };
    });
  }

  /**
   * Returns true if the organization has no existing critical applications.
   * Used to conditionally show different titles and descriptions.
   */
  protected hasNoCriticalApplications(): boolean {
    return !this.dialogParams.hasExistingCriticalApplications;
  }

  /**
   * Maps applications to a corresponding iconCipher
   *
   * @param applications
   */
  setApplicationsWithIcons(applications: ApplicationHealthReportDetail[]) {
    // Map the report data to include the iconCipher for each application
    const iconCiphers = new Map<string, CipherIcon>();
    applications.forEach((app) => {
      const iconCipher =
        app.cipherIds.length > 0 ? this.dataService.getCipherIcon(app.cipherIds[0]) : undefined;
      iconCiphers.set(app.applicationName, iconCipher);
    });
    this.applicationIcons.set(iconCiphers);
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

  // Checks if there are selected applications and proceeds to assign tasks
  async handleMarkAsCritical() {
    if (this.selectedApplications().size === 0) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "confirmNoSelectedCriticalApplicationsTitle" },
        content: { key: "confirmNoSelectedCriticalApplicationsDesc" },
        type: "warning",
      });

      if (!confirmed) {
        return;
      }
    }

    // Skip the assign tasks view if there are no new unassigned at-risk cipher IDs
    if (this.newUnassignedAtRiskCipherIds().length === 0) {
      this.handleAssignTasks();
    } else {
      this.currentView.set(DialogView.AssignTasks);
    }
  }

  // Saves the application review and assigns tasks for unassigned at-risk ciphers
  protected handleAssignTasks() {
    if (this.saving()) {
      return; // Prevent double-click
    }
    this.saving.set(true);

    const reviewedDate = new Date();
    const updatedApplications = this.dialogParams.newApplications.map((app) => {
      const isCritical = this.selectedApplications().has(app.applicationName);
      return {
        applicationName: app.applicationName,
        isCritical,
        reviewedDate,
      };
    });

    // Save the application review dates and critical markings
    this.dataService
      .saveApplicationReviewStatus(updatedApplications)
      .pipe(
        takeUntilDestroyed(this.destroyRef), // Satisfy eslint rule
        take(1),
        switchMap(() => {
          // Assign password change tasks for unassigned at-risk ciphers for critical applications
          return from(
            this.securityTasksService.requestPasswordChangeForCriticalApplications(
              this.dialogParams.organizationId,
              this.newUnassignedAtRiskCipherIds(),
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
