// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { ChangeDetectionStrategy, Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { HecConfiguration } from "@bitwarden/bit-common/dirt/organization-integrations/models/configuration/hec-configuration";
import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import {
  IntegrationDialogResultStatus,
  IntegrationDialogResultStatusType,
} from "../integration-dialog-result-status";

export type ConnectViaHecTokenDialogParams = {
  settings: Integration;
  saveCallback: (url: string, token: string) => Promise<string | null>;
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
    private dialogRef: DialogRef<ConnectViaHecTokenDialogResult, ConnectViaHecTokenDialogComponent>,
    private dialogService: DialogService,
    private toastService: ToastService,
    private i18nService: I18nService,
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

    if (this.connectInfo.saveCallback) {
      const { url, token } = this.formGroup.getRawValue();
      try {
        const errorMessage = await this.connectInfo.saveCallback(url ?? "", token ?? "");
        if (errorMessage !== null) {
          // 400: server rejected the config — show error, keep dialog open
          this.toastService.showToast({
            variant: "error",
            title: "",
            message: errorMessage || this.i18nService.t("failedToSaveIntegration"),
          });
          return;
        }
        // null = success; callback already showed toast and updated state
        await this.dialogRef.close(
          this.getDialogResult(IntegrationDialogResultStatus.SavedViaCallback),
        );
      } catch {
        // Other errors: callback already showed toast; close without result
        await this.dialogRef.close();
      }
      return;
    }

    const result = this.getDialogResult(IntegrationDialogResultStatus.Edited);
    await this.dialogRef.close(result);
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
      await this.dialogRef.close(result);
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
  config: DialogConfig<ConnectViaHecTokenDialogParams, ConnectViaHecTokenDialogResult>,
) {
  return dialogService.open<ConnectViaHecTokenDialogResult>(
    ConnectViaHecTokenDialogComponent,
    config,
  );
}
