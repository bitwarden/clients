// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, EventEmitter, Inject, OnInit, Output } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { UpdateTwoFactorDuoRequest } from "@bitwarden/common/auth/models/request/update-two-factor-duo.request";
import { TwoFactorDuoResponse } from "@bitwarden/common/auth/models/response/two-factor-duo.response";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { TwoFactorSetupMethodBaseComponent } from "./two-factor-setup-method-base.component";

@Component({
  selector: "app-two-factor-setup-duo",
  templateUrl: "two-factor-setup-duo.component.html",
})
export class TwoFactorSetupDuoComponent
  extends TwoFactorSetupMethodBaseComponent
  implements OnInit
{
  @Output() onChangeStatus: EventEmitter<boolean> = new EventEmitter();

  type = TwoFactorProviderType.Duo;
  formGroup = this.formBuilder.group({
    clientId: ["", [Validators.required]],
    clientSecret: ["", [Validators.required]],
    host: ["", [Validators.required]],
  });
  override componentName = "app-two-factor-duo";

  constructor(
    @Inject(DIALOG_DATA) protected data: TwoFactorDuoComponentConfig,
    apiService: ApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef,
    protected toastService: ToastService,
  ) {
    super(
      apiService,
      i18nService,
      platformUtilsService,
      logService,
      userVerificationService,
      dialogService,
      toastService,
    );
  }

  get clientId() {
    return this.formGroup.get("clientId").value;
  }
  get clientSecret() {
    return this.formGroup.get("clientSecret").value;
  }
  get host() {
    return this.formGroup.get("host").value;
  }
  set clientId(value: string) {
    this.formGroup.get("clientId").setValue(value);
  }
  set clientSecret(value: string) {
    this.formGroup.get("clientSecret").setValue(value);
  }
  set host(value: string) {
    this.formGroup.get("host").setValue(value);
  }

  async ngOnInit() {
    if (!this.data?.authResponse) {
      throw Error("TwoFactorDuoComponent requires a TwoFactorDuoResponse to initialize");
    }

    super.auth(this.data.authResponse);
    this.processResponse(this.data.authResponse.response);

    if (this.data.organizationId) {
      this.type = TwoFactorProviderType.OrganizationDuo;
      this.organizationId = this.data.organizationId;
    }
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }
    if (this.enabled) {
      await this.disableMethod();
    } else {
      await this.enable();
    }
    this.onChangeStatus.emit(this.enabled);
  };

  protected async enable() {
    const request = await this.buildRequestModel(UpdateTwoFactorDuoRequest);
    request.clientId = this.clientId;
    request.clientSecret = this.clientSecret;
    request.host = this.host;

    let response: TwoFactorDuoResponse;

    if (this.organizationId != null) {
      response = await this.apiService.putTwoFactorOrganizationDuo(this.organizationId, request);
    } else {
      response = await this.apiService.putTwoFactorDuo(request);
    }

    this.processResponse(response);
    this.onUpdated.emit(true);
  }

  onClose = () => {
    this.dialogRef.close(this.enabled);
  };

  private processResponse(response: TwoFactorDuoResponse) {
    this.clientId = response.clientId;
    this.clientSecret = response.clientSecret;
    this.host = response.host;
    this.enabled = response.enabled;
  }

  /**
   * Strongly typed helper to open a TwoFactorDuoComponentComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param config Configuration for the dialog
   */
  static open = (
    dialogService: DialogService,
    config: DialogConfig<TwoFactorDuoComponentConfig>,
  ) => {
    return dialogService.open<boolean>(TwoFactorSetupDuoComponent, config);
  };
}

type TwoFactorDuoComponentConfig = {
  authResponse: AuthResponse<TwoFactorDuoResponse>;
  organizationId?: string;
};
