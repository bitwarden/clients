import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Inject, OnInit, Output } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { UpdateTwoFactorDuoRequest } from "@bitwarden/common/auth/models/request/update-two-factor-duo.request";
import { TwoFactorDuoResponse } from "@bitwarden/common/auth/models/response/two-factor-duo.response";
import { TwoFactorApiService } from "@bitwarden/common/auth/two-factor";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconModule,
  InputModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { TwoFactorSetupMethodBaseComponent } from "./two-factor-setup-method-base.component";

@Component({
  selector: "app-two-factor-setup-duo",
  templateUrl: "two-factor-setup-duo.component.html",
  imports: [
    CommonModule,
    DialogModule,
    FormFieldModule,
    InputModule,
    TypographyModule,
    ButtonModule,
    IconModule,
    I18nPipe,
    ReactiveFormsModule,
    AsyncActionsModule,
    CalloutModule,
  ],
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
    twoFactorApiService: TwoFactorApiService,
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
      twoFactorApiService,
      i18nService,
      platformUtilsService,
      logService,
      userVerificationService,
      dialogService,
      toastService,
    );
  }

  get clientId(): string {
    return this.formGroup.get("clientId")?.value || "";
  }
  get clientSecret(): string {
    return this.formGroup.get("clientSecret")?.value || "";
  }
  get host(): string {
    return this.formGroup.get("host")?.value || "";
  }
  set clientId(value: string) {
    this.formGroup.get("clientId")?.setValue(value);
  }
  set clientSecret(value: string) {
    this.formGroup.get("clientSecret")?.setValue(value);
  }
  set host(value: string) {
    this.formGroup.get("host")?.setValue(value);
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
      response = await this.twoFactorApiService.putTwoFactorOrganizationDuo(
        this.organizationId,
        request,
      );
    } else {
      response = await this.twoFactorApiService.putTwoFactorDuo(request);
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
    return dialogService.open<boolean, TwoFactorDuoComponentConfig>(
      TwoFactorSetupDuoComponent,
      config as DialogConfig<TwoFactorDuoComponentConfig, DialogRef<boolean>>,
    );
  };
}

type TwoFactorDuoComponentConfig = {
  authResponse: AuthResponse<TwoFactorDuoResponse>;
  organizationId?: string;
};
