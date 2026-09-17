import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { HecConfiguration } from "@bitwarden/bit-common/dirt/organization-integrations/models/configuration/hec-configuration";
import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { HecTemplate } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration-configuration-config/configuration-template/hec-template";
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

export type HecConnectDialogParams = {
  settings: Integration;
  saveCallback: (url: string, bearerToken: string, index: string) => Promise<string | null>;
};

export interface HecConnectDialogResult {
  integrationSettings: Integration;
  url: string;
  bearerToken: string;
  index: string;
  service: string;
  success: IntegrationDialogResultStatusType | null;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./connect-dialog-hec.component.html",
  imports: [SharedModule],
})
export class ConnectHecDialogComponent implements OnInit {
  loading = false;
  hecConfig: HecConfiguration | null = null;
  hecTemplate: HecTemplate | null = null;
  formGroup = this.formBuilder.group({
    url: ["", [Validators.required, Validators.minLength(7)]],
    bearerToken: ["", Validators.required],
    index: ["", Validators.required],
    service: ["", Validators.required],
  });

  constructor(
    @Inject(DIALOG_DATA) protected connectInfo: HecConnectDialogParams,
    protected formBuilder: FormBuilder,
    private dialogRef: DialogRef<HecConnectDialogResult>,
    private dialogService: DialogService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  ngOnInit(): void {
    this.hecConfig =
      this.connectInfo.settings.organizationIntegration?.getConfiguration<HecConfiguration>() ??
      null;
    this.hecTemplate =
      this.connectInfo.settings.organizationIntegration?.integrationConfiguration?.[0]?.getTemplate<HecTemplate>() ??
      null;

    this.formGroup.patchValue({
      url: this.hecConfig?.uri || "",
      bearerToken: this.hecConfig?.token || "",
      index: this.hecTemplate?.index || "",
      service: this.connectInfo.settings.name,
    });
  }

  get isUpdateAvailable(): boolean {
    return !!this.hecConfig;
  }

  get canDelete(): boolean {
    return !!this.hecConfig;
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
      const { url, bearerToken, index } = this.formGroup.getRawValue();
      try {
        const errorMessage = await this.connectInfo.saveCallback(
          url ?? "",
          bearerToken ?? "",
          index ?? "",
        );
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
          this.getHecConnectDialogResult(IntegrationDialogResultStatus.SavedViaCallback),
        );
      } catch {
        // Other errors: callback already showed toast; close without result
        await this.dialogRef.close();
      }
      return;
    }

    const result = this.getHecConnectDialogResult(IntegrationDialogResultStatus.Edited);
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
      const result = this.getHecConnectDialogResult(IntegrationDialogResultStatus.Delete);
      await this.dialogRef.close(result);
    }
  };

  private getHecConnectDialogResult(
    status: IntegrationDialogResultStatusType,
  ): HecConnectDialogResult {
    const formJson = this.formGroup.getRawValue();

    return {
      integrationSettings: this.connectInfo.settings,
      url: formJson.url || "",
      bearerToken: formJson.bearerToken || "",
      index: formJson.index || "",
      service: formJson.service || "",
      success: status,
    };
  }
}

export function openHecConnectDialog(
  dialogService: DialogService,
  config: DialogConfig<HecConnectDialogParams, HecConnectDialogResult>,
) {
  return dialogService.open<HecConnectDialogResult>(ConnectHecDialogComponent, config);
}
