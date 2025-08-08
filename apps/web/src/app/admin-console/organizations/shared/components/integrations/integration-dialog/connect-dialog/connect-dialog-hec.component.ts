import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

// eslint-disable-next-line no-restricted-imports
import {
  HecConfiguration,
  HecConfigurationTemplate,
} from "@bitwarden/bit-common/dirt/integrations";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { Integration } from "../../models";

export type HecConnectDialogParams = {
  settings: Integration;
  configuration: HecConfiguration | null;
  template: HecConfigurationTemplate | null;
};

export interface HecConnectDialogResult {
  integrationSettings: Integration;
  url: string;
  bearerToken: string;
  index: string;
  service: string;
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
    this.formGroup.patchValue({
      url: this.connectInfo.configuration?.uri || "",
      bearerToken: this.connectInfo.configuration?.token || "",
      index: this.connectInfo.template?.index || "",
      service: this.connectInfo.settings.name,
    });
  }

  isUpdateAvailable(): boolean {
    return !!this.connectInfo.configuration;
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
      url: formJson.url || "",
      bearerToken: formJson.bearerToken || "",
      index: formJson.index || "",
      service: formJson.service || "",
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
