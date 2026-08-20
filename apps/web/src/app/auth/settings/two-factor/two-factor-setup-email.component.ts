import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Inject, OnInit, Output } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorService, TwoFactorSetupDialogData } from "@bitwarden/common/auth/two-factor";
import { TwoFactorEmailDeleteRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-email-delete.request";
import { TwoFactorEmailSetupRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-email-setup.request";
import { TwoFactorEmailUpdateRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-email-update.request";
import { TwoFactorEmailDetailsResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-email-details.response";
import { TwoFactorEmailResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-email.response";
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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-two-factor-setup-email",
  templateUrl: "two-factor-setup-email.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    CommonModule,
    DialogModule,
    FormFieldModule,
    SvgModule,
    I18nPipe,
    InputModule,
    ReactiveFormsModule,
    TypographyModule,
  ],
})
export class TwoFactorSetupEmailComponent
  extends TwoFactorSetupMethodBaseComponent
  implements OnInit
{
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onChangeStatus: EventEmitter<boolean> = new EventEmitter();
  type = TwoFactorProviderType.Email;
  sentEmail: string = "";
  emailPromise: Promise<unknown> | undefined;
  override componentName = "app-two-factor-email";
  private userVerificationToken: string | undefined;

  private requireUserVerificationToken(): string {
    if (this.userVerificationToken === undefined) {
      throw new Error("User verification token is missing");
    }
    return this.userVerificationToken;
  }
  formGroup = this.formBuilder.group({
    token: ["", [Validators.required]],
    email: ["", [Validators.email, Validators.required]],
  });

  constructor(
    @Inject(DIALOG_DATA) protected data: TwoFactorSetupDialogData<TwoFactorEmailResponse>,
    twoFactorService: TwoFactorService,
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
      twoFactorService,
      i18nService,
      platformUtilsService,
      logService,
      userVerificationService,
      dialogService,
      toastService,
    );
  }
  get token(): string {
    return this.formGroup.get("token")?.value || "";
  }
  set token(value: string | null) {
    this.formGroup.get("token")?.setValue(value || "");
  }
  get email(): string {
    return this.formGroup.get("email")?.value || "";
  }
  set email(value: string | null | undefined) {
    this.formGroup.get("email")?.setValue(value || "");
  }

  async ngOnInit() {
    await this.auth(this.data);
  }

  auth(authResponse: TwoFactorSetupDialogData<TwoFactorEmailResponse>) {
    super.auth(authResponse);
    return this.processGetResponse(authResponse.response);
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
    return this.disableMethod();
  }

  sendEmail = async () => {
    const request = new TwoFactorEmailSetupRequest(this.email, this.requireUserVerificationToken());
    this.emailPromise = this.twoFactorService.postTwoFactorEmailSetup(request);
    await this.emailPromise;
    this.sentEmail = this.email;
  };

  protected async enable() {
    const request = new TwoFactorEmailUpdateRequest(
      this.token,
      this.email,
      this.requireUserVerificationToken(),
    );

    const response = await this.twoFactorService.putTwoFactorEmail(request);
    await this.applyEmailDetails(response.email);
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

    const request = new TwoFactorEmailDeleteRequest(this.requireUserVerificationToken());
    await this.twoFactorService.deleteTwoFactorEmail(request);
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

  private async processGetResponse(response: TwoFactorEmailResponse) {
    this.userVerificationToken = response.userVerificationToken;
    await this.applyEmailDetails(response.email);
  }

  private async applyEmailDetails(emailDetails: TwoFactorEmailDetailsResponse) {
    this.token = null;
    this.email = emailDetails.email;
    this.enabled = emailDetails.enabled;
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
    config: DialogConfig<TwoFactorSetupDialogData<TwoFactorEmailResponse>>,
  ) {
    return dialogService.open<boolean, TwoFactorSetupDialogData<TwoFactorEmailResponse>>(
      TwoFactorSetupEmailComponent,
      config as DialogConfig<TwoFactorSetupDialogData<TwoFactorEmailResponse>, boolean>,
    );
  }
}
