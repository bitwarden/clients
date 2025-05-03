import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { ChangePasswordComponent } from "@bitwarden/auth/angular";
import {
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogService,
  FormFieldModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

type EmergencyAccessTakeoverDialogData = {
  grantorName: string;
  grantorEmail: string;
  /** Traces a unique emergency request */
  emergencyAccessId: string;
};

export enum EmergencyAccessTakeoverDialogResultType {
  Done = "done",
}

/**
 * This component is used by a Grantee to take over emergency access of a Grantor's account
 * by changing the Grantor's master password. It is displayed as a dialog when the Grantee
 * clicks the "Takeover" button while on the `/settings/emergency-access` page (see `EmergencyAccessComponent`).
 *
 * @link https://bitwarden.com/help/emergency-access/
 */
@Component({
  standalone: true,
  selector: "auth-emergency-access-takeover-dialog",
  templateUrl: "./emergency-access-takeover-dialog.component.html",
  imports: [
    ButtonModule,
    CommonModule,
    CalloutModule,
    ChangePasswordComponent,
    DialogModule,
    FormFieldModule,
    I18nPipe,
  ],
})
export class EmergencyAccessTakeoverDialogComponent {
  constructor(@Inject(DIALOG_DATA) protected dialogData: EmergencyAccessTakeoverDialogData) {}

  /**
   * Strongly typed helper to open a EmergencyAccessTakeoverDialogComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param dialogConfig Configuration for the dialog
   */
  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<EmergencyAccessTakeoverDialogData>,
  ) => {
    return dialogService.open<EmergencyAccessTakeoverDialogResultType>(
      EmergencyAccessTakeoverDialogComponent,
      dialogConfig,
    );
  };
}
