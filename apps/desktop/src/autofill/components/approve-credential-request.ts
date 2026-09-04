import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  DialogService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export interface ApproveCredentialRequestParams {
  cipherName: string;
  applicationName: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-approve-credential-request",
  templateUrl: "approve-credential-request.html",
  imports: [
    DialogModule,
    CommonModule,
    I18nPipe,
    ButtonModule,
    IconButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    FormFieldModule,
  ],
})
export class ApproveCredentialRequestComponent {
  approveCredentialRequestForm = this.formBuilder.group({});

  constructor(
    @Inject(DIALOG_DATA) protected params: ApproveCredentialRequestParams,
    private dialogRef: DialogRef<boolean>,
    private formBuilder: FormBuilder,
  ) {}

  static open(dialogService: DialogService, cipherName: string, applicationName: string) {
    return dialogService.open<boolean, ApproveCredentialRequestParams>(
      ApproveCredentialRequestComponent,
      {
        data: { cipherName, applicationName },
      },
    );
  }

  submit = async () => {
    await this.dialogRef.close(true);
  };
}
