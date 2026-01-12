import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { DatadogConfiguration } from "@bitwarden/bit-common/dirt/organization-integrations/models/configuration/datadog-configuration";
import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { HecTemplate } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration-configuration-config/configuration-template/hec-template";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

export type DatadogConnectDialogParams = {
  settings: Integration;
};

export interface DatadogConnectDialogResult {
  integrationSettings: Integration;
  url: string;
  apiKey: string;
  service: string;
  success: DatadogConnectDialogResultStatusType | null;
}

export const DatadogConnectDialogResultStatus = {
  Edited: "edit",
  Delete: "delete",
} as const;

export type DatadogConnectDialogResultStatusType =
  (typeof DatadogConnectDialogResultStatus)[keyof typeof DatadogConnectDialogResultStatus];

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./connect-dialog-datadog.component.html",
  imports: [SharedModule],
})
export class ConnectDatadogDialogComponent implements OnInit {
  loading = false;
  datadogConfig: DatadogConfiguration | null = null;
  hecTemplate: HecTemplate | null = null;
  formGroup = this.formBuilder.group({
    url: ["", [Validators.required, Validators.minLength(7)]],
    apiKey: ["", Validators.required],
    service: ["", Validators.required],
  });

  constructor(
    @Inject(DIALOG_DATA) protected connectInfo: DatadogConnectDialogParams,
    protected formBuilder: FormBuilder,
    private dialogRef: DialogRef<DatadogConnectDialogResult>,
    private dialogService: DialogService,
  ) {}

  ngOnInit(): void {
    this.datadogConfig =
      this.connectInfo.settings.organizationIntegration?.getConfiguration<DatadogConfiguration>() ??
      null;
    this.hecTemplate =
      this.connectInfo.settings.organizationIntegration?.integrationConfiguration?.[0]?.getTemplate<HecTemplate>() ??
      null;

    this.formGroup.patchValue({
      url: this.datadogConfig?.uri || "",
      apiKey: this.datadogConfig?.apiKey || "",
      service: this.connectInfo.settings.name,
    });
  }

  get isUpdateAvailable(): boolean {
    return !!this.datadogConfig;
  }

  get canDelete(): boolean {
    return !!this.datadogConfig;
  }

  submit = async (): Promise<void> => {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }
    const result = this.getDatadogConnectDialogResult(DatadogConnectDialogResultStatus.Edited);

    this.dialogRef.close(result);

    return;
  };

  delete = async (): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: {
        key: "deleteItemConfirmation",
      },
      type: "warning",
    });

    if (confirmed) {
      const result = this.getDatadogConnectDialogResult(DatadogConnectDialogResultStatus.Delete);
      this.dialogRef.close(result);
    }
  };

  private getDatadogConnectDialogResult(
    status: DatadogConnectDialogResultStatusType,
  ): DatadogConnectDialogResult {
    const formJson = this.formGroup.getRawValue();

    return {
      integrationSettings: this.connectInfo.settings,
      url: formJson.url || "",
      apiKey: formJson.apiKey || "",
      service: formJson.service || "",
      success: status,
    };
  }
}

export function openDatadogConnectDialog(
  dialogService: DialogService,
  config: DialogConfig<DatadogConnectDialogParams, DialogRef<DatadogConnectDialogResult>>,
) {
  return dialogService.open<DatadogConnectDialogResult>(ConnectDatadogDialogComponent, config);
}
