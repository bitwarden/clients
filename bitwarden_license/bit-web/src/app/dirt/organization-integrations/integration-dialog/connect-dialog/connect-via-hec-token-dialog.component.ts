// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
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

export type ConnectViaHecTokenDialogParams = {
  settings: Integration;
};

export interface ConnectViaHecTokenDialogResult {
  integrationSettings: Integration;
  url: string;
  token: string;
  service: string;
  success: IntegrationDialogResultStatusType | null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./connect-via-hec-token-dialog.component.html",
  imports: [SharedModule],
})
export class ConnectViaHecTokenDialogComponent implements OnInit {
  loading = false;
  hecConfiguration: HecConfiguration | null = null;
  formGroup = this.formBuilder.group({
    url: ["", [Validators.required, Validators.minLength(7)]],
    token: ["", Validators.required],
    service: [""], // Programmatically set in ngOnInit, not shown to user
  });

  constructor(
    @Inject(DIALOG_DATA) protected connectInfo: ConnectViaHecTokenDialogParams,
    protected formBuilder: FormBuilder,
    private dialogRef: DialogRef<ConnectViaHecTokenDialogResult>,
    private dialogService: DialogService,
  ) {}

  ngOnInit(): void {
    this.hecConfiguration =
      this.connectInfo.settings.organizationIntegration?.getConfiguration<HecConfiguration>() ??
      null;

    this.formGroup.patchValue({
      url: this.hecConfiguration?.uri || "",
      token: this.hecConfiguration?.token || "",
      service: this.connectInfo.settings.name,
    });
  }

  get isUpdateAvailable(): boolean {
    return !!this.hecConfiguration;
  }

  get canDelete(): boolean {
    return !!this.hecConfiguration;
  }

  get urlHelperLinkText(): string {
    return this.connectInfo.settings.urlHelperLinkText ?? "";
  }

  submit = async (): Promise<void> => {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }
    const result = this.getDialogResult(IntegrationDialogResultStatus.Edited);

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
      const result = this.getDialogResult(IntegrationDialogResultStatus.Delete);
      this.dialogRef.close(result);
    }
  };

  private getDialogResult(
    status: IntegrationDialogResultStatusType,
  ): ConnectViaHecTokenDialogResult {
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

export function openConnectViaHecTokenDialog(
  dialogService: DialogService,
  config: DialogConfig<ConnectViaHecTokenDialogParams, DialogRef<ConnectViaHecTokenDialogResult>>,
) {
  return dialogService.open<ConnectViaHecTokenDialogResult>(
    ConnectViaHecTokenDialogComponent,
    config,
  );
}
