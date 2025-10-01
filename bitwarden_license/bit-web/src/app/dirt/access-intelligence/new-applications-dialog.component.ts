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

@Component({
  templateUrl: "./new-applications-dialog.component.html",
  imports: [ButtonModule, DialogModule, TypographyModule, I18nPipe],
})
export class NewApplicationsDialogComponent {
  protected newApplications: string[] = [];

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
   * Placeholder handler for mark as critical functionality.
   * Shows a toast notification indicating the feature is coming in a future update.
   * TODO: Implement actual mark as critical functionality (PM-26203 follow-up)
   */
  onMarkAsCritical = () => {
    this.toastService.showToast({
      variant: "info",
      title: this.i18nService.t("markAppAsCritical"),
      message: this.i18nService.t("markAsCriticalPlaceholder"),
    });
  };
}
