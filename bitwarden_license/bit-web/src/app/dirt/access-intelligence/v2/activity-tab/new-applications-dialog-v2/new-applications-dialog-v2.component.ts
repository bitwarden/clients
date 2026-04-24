import { CommonModule } from "@angular/common";
import {
  Component,
  DestroyRef,
  inject,
  ChangeDetectionStrategy,
  signal,
  computed,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { EMPTY, catchError, switchMap } from "rxjs";

import { AccessIntelligenceDataService } from "@bitwarden/bit-common/dirt/access-intelligence";
import { ApplicationHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  DIALOG_DATA,
  IconComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AssignTasksViewComponent } from "../../../activity/application-review-dialog/assign-tasks-view.component";
import { AccessSecurityTasksService } from "../../services/abstractions/access-security-tasks.service";

import { ReviewApplicationsViewV2Component } from "./review-applications-view-v2/review-applications-view-v2.component";

/**
 * Data passed to the new applications dialog.
 */
export interface NewApplicationsDialogV2Data {
  /** New applications (ApplicationHealthView objects without reviewedDate) */
  newApplications: ApplicationHealthView[];
  /** Organization ID for API calls */
  organizationId: OrganizationId;
  /** Whether org has existing critical apps (affects dialog messaging) */
  hasExistingCriticalApplications: boolean;
}

/**
 * View states for dialog navigation
 */
export const DialogView = Object.freeze({
  SelectApplications: "select",
  AssignTasks: "assign",
} as const);

export type DialogView = (typeof DialogView)[keyof typeof DialogView];

/**
 * Dialog result types
 */
export const NewApplicationsDialogResultType = Object.freeze({
  Close: "close",
  Complete: "complete",
} as const);

export type NewApplicationsDialogResultType =
  (typeof NewApplicationsDialogResultType)[keyof typeof NewApplicationsDialogResultType];

/**
 * Dialog for reviewing newly discovered applications.
 *
 * Presents a two-step flow: first select which applications to mark as critical,
 * then assign password change tasks to members with at-risk credentials in those apps.
 * All applications in the list are marked as reviewed when the dialog completes.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-new-applications-dialog-v2",
  standalone: true,
  templateUrl: "./new-applications-dialog-v2.component.html",
  imports: [
    ButtonModule,
    CommonModule,
    DialogModule,
    IconComponent,
    TypographyModule,
    I18nPipe,
    AssignTasksViewComponent,
    ReviewApplicationsViewV2Component,
  ],
})
export class NewApplicationsDialogV2Component {
  private readonly destroyRef = inject(DestroyRef);
  private readonly accessIntelligenceService = inject(AccessIntelligenceDataService);
  private readonly dialogRef = inject(DialogRef<NewApplicationsDialogResultType>);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly securityTasksService = inject(AccessSecurityTasksService);
  private readonly toastService = inject(ToastService);

  protected readonly dialogParams = inject<NewApplicationsDialogV2Data>(DIALOG_DATA);

  protected readonly currentView = signal<DialogView>(DialogView.SelectApplications);
  protected readonly DialogView = DialogView;

  protected readonly selectedApplications = signal<Set<string>>(new Set());

  protected readonly saving = signal<boolean>(false);

  protected readonly ciphers = toSignal(this.accessIntelligenceService.ciphers$, {
    initialValue: [],
  });

  protected readonly newCriticalApplications = computed(() => {
    return this.dialogParams.newApplications.filter((app) =>
      this.selectedApplications().has(app.applicationName),
    );
  });

  protected readonly newAtRiskCriticalApplications = computed(() => {
    return this.newCriticalApplications().filter((report) => report.isAtRisk());
  });

  protected readonly atRiskCriticalMembersCount = computed(() => {
    const memberIds = new Set<string>();

    this.newCriticalApplications().forEach((report) => {
      Object.entries(report.memberRefs)
        .filter(([_, isAtRisk]) => isAtRisk)
        .forEach(([memberId]) => memberIds.add(memberId));
    });

    return memberIds.size;
  });

  protected readonly newUnassignedAtRiskCipherIds = computed<CipherId[]>(() => {
    const atRiskCipherIds: CipherId[] = [];

    this.newCriticalApplications().forEach((report) => {
      const atRiskIds = report.getAtRiskCipherIds();
      atRiskCipherIds.push(...(atRiskIds as CipherId[]));
    });

    return atRiskCipherIds;
  });

  /**
   * Static method to open the dialog
   */
  static open(
    dialogService: DialogService,
    data: NewApplicationsDialogV2Data,
  ): DialogRef<NewApplicationsDialogResultType> {
    return dialogService.open<NewApplicationsDialogResultType>(NewApplicationsDialogV2Component, {
      data,
    });
  }

  /**
   * Returns true if the organization has no existing critical applications.
   * Used to conditionally show different titles and descriptions.
   */
  protected hasNoCriticalApplications(): boolean {
    return !this.dialogParams.hasExistingCriticalApplications;
  }

  // View navigation
  protected navigateToAssignTasks(): void {
    this.currentView.set(DialogView.AssignTasks);
  }

  protected navigateToSelectApplications(): void {
    this.currentView.set(DialogView.SelectApplications);
  }

  // Application selection
  protected toggleSelection(applicationName: string): void {
    this.selectedApplications.update((selected) => {
      const next = new Set(selected);
      if (next.has(applicationName)) {
        next.delete(applicationName);
      } else {
        next.add(applicationName);
      }
      return next;
    });
  }

  protected toggleAll(): void {
    const allSelected = this.isAllSelected();
    if (allSelected) {
      this.selectedApplications.set(new Set());
    } else {
      const allNames = this.dialogParams.newApplications.map((app) => app.applicationName);
      this.selectedApplications.set(new Set(allNames));
    }
  }

  protected isAllSelected(): boolean {
    return (
      this.dialogParams.newApplications.length > 0 &&
      this.dialogParams.newApplications.every((app) =>
        this.selectedApplications().has(app.applicationName),
      )
    );
  }

  // Dialog actions

  /**
   * Handles the "Mark as critical" button click.
   * Shows confirmation if no applications selected, then proceeds to assign tasks or completes.
   */
  protected async handleMarkAsCritical() {
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

  /**
   * Handles the "Assign tasks" button click.
   * Marks applications as critical/reviewed and assigns security tasks.
   */
  protected handleAssignTasks() {
    if (this.saving()) {
      return; // Prevent double-click
    }

    this.saving.set(true);

    const reviewedDate = new Date();
    const allAppNames = this.dialogParams.newApplications.map((app) => app.applicationName);
    const criticalAppNames = this.dialogParams.newApplications
      .filter((app) => this.selectedApplications().has(app.applicationName))
      .map((app) => app.applicationName);

    // Mark all apps as reviewed, then mark selected as critical (also reviewed via view model)
    this.accessIntelligenceService
      .markApplicationsAsReviewed$(allAppNames, reviewedDate)
      .pipe(
        switchMap(() =>
          this.accessIntelligenceService.markApplicationsAsCritical$(criticalAppNames),
        ),
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => {
          // Assign password change tasks for unassigned at-risk ciphers
          return this.securityTasksService.requestPasswordChangeForCriticalApplications$(
            this.dialogParams.organizationId,
            this.newUnassignedAtRiskCipherIds(),
          );
        }),
        catchError((error: unknown) => {
          if (error instanceof ErrorResponse && error.statusCode === 404) {
            this.toastService.showToast({
              message: this.i18nService.t("mustBeOrganizationOwnerAdmin"),
              variant: "error",
              title: this.i18nService.t("error"),
            });

            this.saving.set(false);
            return EMPTY;
          }

          this.logService.error(
            "[NewApplicationsDialogV2] Failed to save application review or assign tasks",
            error,
          );

          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorSavingReviewStatus"),
            message: this.i18nService.t("pleaseTryAgain"),
          });

          this.saving.set(false);
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.toastService.showToast({
          variant: "success",
          title: this.i18nService.t("applicationReviewSaved"),
          message: this.i18nService.t("newApplicationsReviewed"),
        });

        this.saving.set(false);
        void this.dialogRef.close(NewApplicationsDialogResultType.Complete);
      });
  }

  /**
   * Handles the "Cancel" button click.
   * Closes the dialog without saving.
   */
  protected handleCancel() {
    void this.dialogRef.close(NewApplicationsDialogResultType.Close);
  }

  /**
   * Handles the "Back" button click from assign tasks view.
   * Returns to application selection view.
   */
  protected readonly onBack = () => {
    this.currentView.set(DialogView.SelectApplications);
  };
}
