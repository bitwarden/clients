import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { Integration } from "../../models";

export type HecConnectDialogParams = {
  settings: Integration;
};

export interface HecConnectDialogResult {
  integrationSettings: Integration;
  configuration: string;
  success: boolean;
  error: string | null;
}

@Component({
  templateUrl: "./connect-dialog-hec.component.html",
  imports: [SharedModule],
})
export class ConnectHecDialogComponent implements OnInit {
  loading = false;
  formGroup = this.formBuilder.group({
    url: ["", [Validators.required, Validators.pattern("https?://.+")]],
    bearerToken: ["", Validators.required],
    index: ["", Validators.required],
    service: ["", Validators.required],
  });

  constructor(
    @Inject(DIALOG_DATA) protected connectInfo: HecConnectDialogParams,
    protected formBuilder: FormBuilder,
    private dialogRef: DialogRef<HecConnectDialogResult>,
  ) {}

  ngOnInit(): void {
    const settings = this.getSettingsAsJson(this.connectInfo.settings.configuration ?? "");

    if (settings) {
      this.formGroup.patchValue({
        url: settings?.url || "",
        bearerToken: settings?.bearerToken || "",
        index: settings?.index || "",
        service: this.connectInfo.settings.name,
      });
    }
  }

  getSettingsAsJson(configuration: string) {
    try {
      return JSON.parse(configuration);
    } catch {
      return {};
    }
  }

  submit = async (): Promise<void> => {
    const formJson = this.formGroup.getRawValue();

    const result: HecConnectDialogResult = {
      integrationSettings: this.connectInfo.settings,
      configuration: JSON.stringify(formJson),
      success: true,
      error: null,
    };

    this.dialogRef.close(result);

    return;
  };
}

export function openHecConnectDialog(
  dialogService: DialogService,
  config: DialogConfig<HecConnectDialogParams, DialogRef<HecConnectDialogResult>>,
) {
  return dialogService.open<HecConnectDialogResult>(ConnectHecDialogComponent, config);
}
