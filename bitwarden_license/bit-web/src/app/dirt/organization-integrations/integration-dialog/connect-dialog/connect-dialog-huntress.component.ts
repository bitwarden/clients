import { ChangeDetectionStrategy, Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { HecConfiguration } from "@bitwarden/bit-common/dirt/organization-integrations/models/configuration/hec-configuration";
import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import {
  IntegrationDialogResultStatus,
  IntegrationDialogResultStatusType,
} from "../integration-dialog-result-status";

export type HuntressConnectDialogParams = {
  settings: Integration;
};

export interface HuntressConnectDialogResult {
  integrationSettings: Integration;
  url: string;
  token: string;
  service: string;
  success: IntegrationDialogResultStatusType | null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./connect-dialog-huntress.component.html",
  imports: [SharedModule],
})
export class ConnectHuntressDialogComponent implements OnInit {
  loading = false;
  huntressConfig: HecConfiguration | null = null;
  formGroup = this.formBuilder.group({
    url: ["", [Validators.required, Validators.minLength(7)]],
    token: ["", Validators.required],
    service: [""], // Programmatically set in ngOnInit, not shown to user
  });

  constructor(
    @Inject(DIALOG_DATA) protected connectInfo: HuntressConnectDialogParams,
    protected formBuilder: FormBuilder,
    private dialogRef: DialogRef<HuntressConnectDialogResult>,
    private dialogService: DialogService,
  ) {}

  ngOnInit(): void {
    this.huntressConfig =
      this.connectInfo.settings.organizationIntegration?.getConfiguration<HecConfiguration>() ??
      null;

    this.formGroup.patchValue({
      url: this.huntressConfig?.uri || "",
      token: this.huntressConfig?.token || "",
      service: this.connectInfo.settings.name,
    });
  }

  get isUpdateAvailable(): boolean {
    return !!this.huntressConfig;
  }

  get canDelete(): boolean {
    return !!this.huntressConfig;
  }

  submit = async (): Promise<void> => {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }
    const result = this.getHuntressConnectDialogResult(IntegrationDialogResultStatus.Edited);

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
      const result = this.getHuntressConnectDialogResult(IntegrationDialogResultStatus.Delete);
      this.dialogRef.close(result);
    }
  };

  private getHuntressConnectDialogResult(
    status: IntegrationDialogResultStatusType,
  ): HuntressConnectDialogResult {
    const formJson = this.formGroup.getRawValue();

    return {
      integrationSettings: this.connectInfo.settings,
      url: formJson.url || "",
      token: formJson.token || "",
      service: formJson.service || "",
      success: status,
    };
  }
}

export function openHuntressConnectDialog(
  dialogService: DialogService,
  config: DialogConfig<HuntressConnectDialogParams, DialogRef<HuntressConnectDialogResult>>,
) {
  return dialogService.open<HuntressConnectDialogResult>(ConnectHuntressDialogComponent, config);
}
