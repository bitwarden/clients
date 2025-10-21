import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { UpdateTwoFactorYubikeyOtpRequest } from "@bitwarden/common/auth/models/request/update-two-factor-yubikey-otp.request";
import { TwoFactorYubiKeyResponse } from "@bitwarden/common/auth/models/response/two-factor-yubi-key.response";
import { TwoFactorApiService } from "@bitwarden/common/auth/two-factor";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  CheckboxModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  InputModule,
  LinkModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { TwoFactorSetupMethodBaseComponent } from "./two-factor-setup-method-base.component";

interface Key {
  key: string;
  existingKey: string;
}

@Component({
  selector: "app-two-factor-setup-yubikey",
  templateUrl: "two-factor-setup-yubikey.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    DialogModule,
    FormFieldModule,
    ButtonModule,
    IconButtonModule,
    CalloutModule,
    CheckboxModule,
    LinkModule,
    TypographyModule,
    InputModule,
    AsyncActionsModule,
    I18nPipe,
  ],
})
export class TwoFactorSetupYubiKeyComponent
  extends TwoFactorSetupMethodBaseComponent
  implements OnInit
{
  type = TwoFactorProviderType.Yubikey;
  keys: Key[] = [];
  anyKeyHasNfc = false;

  formPromise: Promise<TwoFactorYubiKeyResponse> | undefined;
  disablePromise: Promise<unknown> | undefined;

  override componentName = "app-two-factor-yubikey";
  formGroup:
    | FormGroup<{
        formKeys: FormArray<FormControl<Key | null>>;
        anyKeyHasNfc: FormControl<boolean | null>;
      }>
    | undefined;

  get keysFormControl() {
    return this.formGroup?.controls.formKeys.controls;
  }

  get anyKeyHasNfcFormControl() {
    return this.formGroup?.controls.anyKeyHasNfc;
  }

  constructor(
    @Inject(DIALOG_DATA) protected data: AuthResponse<TwoFactorYubiKeyResponse>,
    twoFactorApiService: TwoFactorApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService,
    private formBuilder: FormBuilder,
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

  ngOnInit() {
    this.auth(this.data);
    this.formGroup = this.formBuilder.group({
      formKeys: this.formBuilder.array<Key>([]),
      anyKeyHasNfc: this.formBuilder.control(this.anyKeyHasNfc),
    });
    this.refreshFormArrayData();
  }

  refreshFormArrayData() {
    if (!this.formGroup) {
      return;
    }
    const formKeys = <FormArray>this.formGroup.get("formKeys");
    formKeys.clear();
    this.keys.forEach((val) => {
      const fb = this.formBuilder.group({
        key: val.key,
        existingKey: val.existingKey,
      });
      formKeys.push(fb);
    });
  }

  auth(authResponse: AuthResponse<TwoFactorYubiKeyResponse>) {
    super.auth(authResponse);
    this.processResponse(authResponse.response);
  }

  submit = async () => {
    if (!this.formGroup) {
      return;
    }
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }
    await this.enable();
  };

  disable = async () => {
    await this.disableMethod();

    if (!this.enabled) {
      for (let i = 0; i < this.keys.length; i++) {
        this.remove(i);
      }
    }
  };

  protected async enable() {
    if (!this.formGroup) {
      return;
    }
    const keys = this.formGroup.controls.formKeys.value;
    const request = await this.buildRequestModel(UpdateTwoFactorYubikeyOtpRequest);
    request.key1 = keys != null && keys.length > 0 ? (keys[0]?.key ?? "") : "";
    request.key2 = keys != null && keys.length > 1 ? (keys[1]?.key ?? "") : "";
    request.key3 = keys != null && keys.length > 2 ? (keys[2]?.key ?? "") : "";
    request.key4 = keys != null && keys.length > 3 ? (keys[3]?.key ?? "") : "";
    request.key5 = keys != null && keys.length > 4 ? (keys[4]?.key ?? "") : "";
    request.nfc = this.formGroup.value.anyKeyHasNfc ?? false;

    this.processResponse(await this.twoFactorApiService.putTwoFactorYubiKey(request));
    this.refreshFormArrayData();
    this.toastService.showToast({
      title: this.i18nService.t("success"),
      message: this.i18nService.t("yubikeysUpdated"),
      variant: "success",
    });
    this.onUpdated.emit(this.enabled);
  }

  remove(pos: number) {
    this.keys[pos].key = "";
    this.keys[pos].existingKey = "";

    if (!this.keysFormControl || !this.keysFormControl[pos]) {
      return;
    }

    this.keysFormControl[pos].setValue({
      existingKey: "",
      key: "",
    });
  }

  private processResponse(response: TwoFactorYubiKeyResponse) {
    this.enabled = response.enabled;
    this.anyKeyHasNfc = response.nfc || !response.enabled;
    this.keys = [
      { key: response.key1, existingKey: this.padRight(response.key1) },
      { key: response.key2, existingKey: this.padRight(response.key2) },
      { key: response.key3, existingKey: this.padRight(response.key3) },
      { key: response.key4, existingKey: this.padRight(response.key4) },
      { key: response.key5, existingKey: this.padRight(response.key5) },
    ];
  }

  private padRight(str: string, character = "•", size = 44) {
    if (str == null || character == null || str.length >= size) {
      return str;
    }
    const max = (size - str.length) / character.length;
    for (let i = 0; i < max; i++) {
      str += character;
    }
    return str;
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<AuthResponse<TwoFactorYubiKeyResponse>>,
  ) {
    return dialogService.open<boolean, AuthResponse<TwoFactorYubiKeyResponse>>(
      TwoFactorSetupYubiKeyComponent,
      config as DialogConfig<AuthResponse<TwoFactorYubiKeyResponse>, DialogRef<boolean>>,
    );
  }
}
