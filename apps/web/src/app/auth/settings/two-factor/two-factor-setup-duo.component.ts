import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Inject, OnInit, Output } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorService, TwoFactorSetupDialogData } from "@bitwarden/common/auth/two-factor";
import { TwoFactorDuoDeleteRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-duo-delete.request";
import { TwoFactorDuoUpdateRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-duo-update.request";
import { TwoFactorOrganizationDuoDeleteRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-organization-duo-delete.request";
import { TwoFactorDuoDetailsResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-duo-details.response";
import { TwoFactorDuoUpdateResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-duo-update.response";
import { TwoFactorDuoResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-duo.response";
import { TwoFactorOrganizationDuoUpdateResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-organization-duo-update.response";
import { TwoFactorOrganizationDuoResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-organization-duo.response";
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
  SvgModule,
  InputModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { TwoFactorSetupMethodBaseComponent } from "./two-factor-setup-method-base.component";

type TwoFactorDuoResponseUnion = TwoFactorDuoResponse | TwoFactorOrganizationDuoResponse;
type TwoFactorDuoUpdateResponseUnion =
  TwoFactorDuoUpdateResponse | TwoFactorOrganizationDuoUpdateResponse;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
    SvgModule,
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
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onChangeStatus: EventEmitter<boolean> = new EventEmitter();

  type: TwoFactorProviderType = TwoFactorProviderType.Duo;
  formGroup = this.formBuilder.group({
    clientId: ["", [Validators.required]],
    clientSecret: ["", [Validators.required]],
    host: ["", [Validators.required]],
  });
  override componentName = "app-two-factor-duo";
  private userVerificationToken: string | undefined;

  private requireUserVerificationToken(): string {
    if (this.userVerificationToken === undefined) {
      throw new Error("User verification token is missing");
    }
    return this.userVerificationToken;
  }

  constructor(
    @Inject(DIALOG_DATA) protected data: TwoFactorDuoComponentConfig,
    twoFactorService: TwoFactorService,
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
      twoFactorService,
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
    this.processGetResponse(this.data.authResponse.response);

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
    const request = new TwoFactorDuoUpdateRequest(
      this.clientId,
      this.clientSecret,
      this.host,
      this.requireUserVerificationToken(),
    );

    let response: TwoFactorDuoUpdateResponseUnion;

    if (this.organizationId != null) {
      response = await this.twoFactorService.putTwoFactorOrganizationDuo(
        this.organizationId,
        request,
      );
    } else {
      response = await this.twoFactorService.putTwoFactorDuo(request);
    }

    this.applyDuoDetails(response.duo);
    this.onUpdated.emit(true);
  }

  protected override async disableMethod() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "disable" },
      content: { key: "twoStepDisableDesc" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    if (this.organizationId != null) {
      const request = new TwoFactorOrganizationDuoDeleteRequest(
        this.requireUserVerificationToken(),
      );
      await this.twoFactorService.deleteTwoFactorOrganizationDuo(this.organizationId, request);
    } else {
      const request = new TwoFactorDuoDeleteRequest(this.requireUserVerificationToken());
      await this.twoFactorService.deleteTwoFactorDuo(request);
    }

    this.enabled = false;
    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("twoStepDisabled"),
    });
    this.onUpdated.emit(false);
  }

  onClose = () => {
    void this.dialogRef.close(this.enabled);
  };

  private processGetResponse(response: TwoFactorDuoResponseUnion) {
    this.userVerificationToken = response.userVerificationToken;
    this.applyDuoDetails(response.duo);
  }

  private applyDuoDetails(duoDetails: TwoFactorDuoDetailsResponse) {
    this.clientId = duoDetails.clientId;
    this.clientSecret = duoDetails.clientSecret;
    this.host = duoDetails.host;
    this.enabled = duoDetails.enabled;
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
      config as DialogConfig<TwoFactorDuoComponentConfig, boolean>,
    );
  };
}

type TwoFactorDuoComponentConfig = {
  authResponse: TwoFactorSetupDialogData<TwoFactorDuoResponseUnion>;
  organizationId?: string;
};
