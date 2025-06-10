import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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

export interface ApproveSshRequestParams {
  cipherName: string;
  applicationName: string;
  isAgentForwarding: boolean;
  action: string;
}

@Component({
  selector: "app-approve-ssh-request",
  templateUrl: "approve-ssh-request.html",
  imports: [
    DialogModule,
    CommonModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    FormFieldModule,
  ],
})
export class ApproveSshRequestComponent {
  approveSshRequestForm = this.formBuilder.group({});

  constructor(
    @Inject(DIALOG_DATA) protected params: ApproveSshRequestParams,
    private dialogRef: DialogRef<boolean>,
    private formBuilder: FormBuilder,
  ) {}

  static open(
    dialogService: DialogService,
    cipherName: string,
    applicationName: string,
    isAgentForwarding: boolean,
    namespace: string,
  ) {
    let actioni18nKey = "sshActionLogin";
    if (namespace === "git") {
      actioni18nKey = "sshActionGitSign";
    } else if (namespace != null && namespace != "") {
      actioni18nKey = "sshActionSign";
    }

    return dialogService.open<boolean, ApproveSshRequestParams>(ApproveSshRequestComponent, {
      data: {
        cipherName,
        applicationName,
        isAgentForwarding,
        action: actioni18nKey,
      },
    });
  }

  submit = async () => {
    this.dialogRef.close(true);
  };
}
