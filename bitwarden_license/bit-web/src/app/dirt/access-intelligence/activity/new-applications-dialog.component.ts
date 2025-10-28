import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export interface NewApplicationsDialogData {
  newApplications: string[];
}

export interface NewApplicationsDialogResult {
  saved: boolean;
  selectedApplications: string[];
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
  protected dialogRef: DialogRef<NewApplicationsDialogResult> | null = null;

  /**
   * Opens the new applications dialog
   * @param dialogService The dialog service instance
   * @param data Dialog data containing the list of new applications
   * @returns Dialog reference
   */
  static open(dialogService: DialogService, data: NewApplicationsDialogData) {
    const ref = dialogService.open<NewApplicationsDialogResult, NewApplicationsDialogData>(
      NewApplicationsDialogComponent,
      {
        data,
      },
    );

    // Set the component's data after opening
    const instance = ref.componentInstance as NewApplicationsDialogComponent;
    if (instance) {
      instance.newApplications = data.newApplications;
      instance.dialogRef = ref;
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
   * Returns the selected applications to the calling component for processing.
   * The calling component is responsible for:
   * - Marking ALL new applications as reviewed (reviewedDate = current date)
   * - Marking SELECTED applications as critical (isCritical = true)
   */
  onMarkAsCritical = () => {
    const selectedApps = Array.from(this.selectedApplications);
    this.dialogRef?.close({
      saved: true,
      selectedApplications: selectedApps,
    });
  };
}
