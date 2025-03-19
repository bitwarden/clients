// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, EventEmitter, Inject, OnInit, Output } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/two-factor-email.request";
import { UpdateTwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/update-two-factor-email.request";
import { TwoFactorEmailResponse } from "@bitwarden/common/auth/models/response/two-factor-email.response";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { TwoFactorSetupMethodBaseComponent } from "./two-factor-setup-method-base.component";

@Component({
  selector: "app-two-factor-setup-email",
  templateUrl: "two-factor-setup-email.component.html",
  outputs: ["onUpdated"],
})
export class TwoFactorSetupEmailComponent
  extends TwoFactorSetupMethodBaseComponent
  implements OnInit
{
  @Output() onChangeStatus: EventEmitter<boolean> = new EventEmitter();
  type = TwoFactorProviderType.Email;
  sentEmail: string;
  emailPromise: Promise<unknown>;
  override componentName = "app-two-factor-email";
  formGroup = this.formBuilder.group({
    token: ["", [Validators.required]],
    email: ["", [Validators.email, Validators.required]],
  });

  constructor(
    @Inject(DIALOG_DATA) protected data: AuthResponse<TwoFactorEmailResponse>,
    apiService: ApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    private accountService: AccountService,
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
  get token() {
    return this.formGroup.get("token").value;
  }
  set token(value: string) {
    this.formGroup.get("token").setValue(value);
  }
  get email() {
    return this.formGroup.get("email").value;
  }
  set email(value: string) {
    this.formGroup.get("email").setValue(value);
  }

  async ngOnInit() {
    await this.auth(this.data);
  }

  auth(authResponse: AuthResponse<TwoFactorEmailResponse>) {
    super.auth(authResponse);
    return this.processResponse(authResponse.response);
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.enabled) {
      await this.disableEmail();
      this.onChangeStatus.emit(false);
    } else {
      if (this.formGroup.invalid) {
        return;
      }
      await this.enable();
      this.onChangeStatus.emit(true);
    }
  };

  private disableEmail() {
    return super.disableMethod();
  }

  sendEmail = async () => {
    const request = await this.buildRequestModel(TwoFactorEmailRequest);
    request.email = this.email;
    this.emailPromise = this.apiService.postTwoFactorEmailSetup(request);
    await this.emailPromise;
    this.sentEmail = this.email;
  };

  protected async enable() {
    const request = await this.buildRequestModel(UpdateTwoFactorEmailRequest);
    request.email = this.email;
    request.token = this.token;

    const response = await this.apiService.putTwoFactorEmail(request);
    await this.processResponse(response);
    this.onUpdated.emit(true);
  }

  onClose = () => {
    this.dialogRef.close(this.enabled);
  };

  private async processResponse(response: TwoFactorEmailResponse) {
    this.token = null;
    this.email = response.email;
    this.enabled = response.enabled;
    if (!this.enabled && (this.email == null || this.email === "")) {
      this.email = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.email)),
      );
    }
  }
  /**
   * Strongly typed helper to open a TwoFactorEmailComponentComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param config Configuration for the dialog
   */
  static open(
    dialogService: DialogService,
    config: DialogConfig<AuthResponse<TwoFactorEmailResponse>>,
  ) {
    return dialogService.open<boolean>(TwoFactorSetupEmailComponent, config);
  }
}
