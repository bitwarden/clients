import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { HecConfiguration } from "@bitwarden/bit-common/dirt/organization-integrations/models/configuration/hec-configuration";
import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { HecTemplate } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration-configuration-config/configuration-template/hec-template";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

export type HecConnectDialogParams = {
  settings: Integration;
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
  hecConfig: HecConfiguration | null = null;
  hecTemplate: HecTemplate | null = null;
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
    this.hecConfig =
      this.connectInfo.settings.organizationIntegration?.getConfiguration<HecConfiguration>();
    this.hecTemplate =
      this.connectInfo.settings.organizationIntegration?.integrationConfiguration?.[0]?.getTemplate<HecTemplate>();

    this.formGroup.patchValue({
      url: this.hecConfig?.uri || "",
      bearerToken: this.hecConfig?.token || "",
      index: this.hecTemplate?.index || "",
      service: this.connectInfo.settings.name,
    });
  }

  isUpdateAvailable(): boolean {
    return !!this.hecConfig;
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
