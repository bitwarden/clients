import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  DialogModule,
  DialogService,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export interface NewApplicationsDialogData {
  newApplications: string[];
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./new-applications-dialog.component.html",
  imports: [CommonModule, ButtonModule, DialogModule, TypographyModule, I18nPipe],
})
export class NewApplicationsDialogComponent {
  protected newApplications: string[] = [];
  protected selectedApplications: Set<string> = new Set<string>();

  private toastService = inject(ToastService);
  private i18nService = inject(I18nService);

  /**
   * Opens the new applications dialog
   * @param dialogService The dialog service instance
   * @param data Dialog data containing the list of new applications
   * @returns Dialog reference
   */
  static open(dialogService: DialogService, data: NewApplicationsDialogData) {
    const ref = dialogService.open<boolean, NewApplicationsDialogData>(
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
   * Placeholder handler for mark as critical functionality.
   * Shows a toast notification with count of selected applications.
   * TODO: Implement actual mark as critical functionality (PM-26203 follow-up)
   */
  onMarkAsCritical = () => {
    const selectedCount = this.selectedApplications.size;
    this.toastService.showToast({
      variant: "info",
      title: this.i18nService.t("markAsCritical"),
      message: `${selectedCount} ${this.i18nService.t("applicationsSelected")}`,
    });
  };
}
