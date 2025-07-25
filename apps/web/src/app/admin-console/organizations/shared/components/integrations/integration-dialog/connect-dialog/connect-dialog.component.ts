import { Component, Inject } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { Integration } from "../../models";

export type ConnectDialogParams = {
  settings: Integration;
};

export interface ConnectDialogResult {
  integrationSettings: Integration;
  url: string;
  bearerToken: string;
  index: string;
  success: boolean;
  error: string | null;
}

@Component({
  templateUrl: "./connect-dialog.component.html",
  imports: [SharedModule],
})
export class ConnectDialogComponent {
  loading = false;
  formGroup = this.formBuilder.group({
    url: ["", [Validators.required, Validators.pattern("https?://.+")]],
    bearerToken: ["", Validators.required],
    index: ["", Validators.required],
  });

  constructor(
    @Inject(DIALOG_DATA) protected connectInfo: ConnectDialogParams,
    protected formBuilder: FormBuilder,
    private dialogRef: DialogRef<ConnectDialogResult>,
  ) {}

  submit = async (): Promise<void> => {
    const formJson = this.formGroup.getRawValue();

    // eslint-disable-next-line no-console
    console.log(`Form submitted with values: ${JSON.stringify(formJson)}`);

    const result: ConnectDialogResult = {
      integrationSettings: this.connectInfo.settings,
      url: this.formGroup.value.url ?? "",
      bearerToken: this.formGroup.value.bearerToken ?? "",
      index: this.formGroup.value.index ?? "",
      success: true,
      error: null,
    };

    // for now, we just log the result
    // eslint-disable-next-line no-console
    console.log(`Dialog closed with result: ${JSON.stringify(result)}`);

    this.dialogRef.close(result);

    return;
  };
}

export function openCrowdstrikeConnectDialog(
  dialogService: DialogService,
  config: DialogConfig<ConnectDialogParams, DialogRef<ConnectDialogResult>>,
) {
  return dialogService.open<ConnectDialogResult>(ConnectDialogComponent, config);
}
