// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig } from "@angular/cdk/dialog";
import { Component, Inject, OnInit } from "@angular/core";
import { FormArray, FormBuilder, FormControl, FormGroup } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { UpdateTwoFactorYubikeyOtpRequest } from "@bitwarden/common/auth/models/request/update-two-factor-yubikey-otp.request";
import { TwoFactorYubiKeyResponse } from "@bitwarden/common/auth/models/response/two-factor-yubi-key.response";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { TwoFactorSetupMethodBaseComponent } from "./two-factor-setup-method-base.component";

interface Key {
  key: string;
  existingKey: string;
}

@Component({
  selector: "app-two-factor-setup-yubikey",
  templateUrl: "two-factor-setup-yubikey.component.html",
})
export class TwoFactorSetupYubiKeyComponent
  extends TwoFactorSetupMethodBaseComponent
  implements OnInit
{
  type = TwoFactorProviderType.Yubikey;
  keys: Key[];
  anyKeyHasNfc = false;

  formPromise: Promise<TwoFactorYubiKeyResponse>;
  disablePromise: Promise<unknown>;

  override componentName = "app-two-factor-yubikey";
  formGroup: FormGroup<{
    formKeys: FormArray<FormControl<Key>>;
    anyKeyHasNfc: FormControl<boolean>;
  }>;

  get keysFormControl() {
    return this.formGroup.controls.formKeys.controls;
  }

  get anyKeyHasNfcFormControl() {
    return this.formGroup.controls.anyKeyHasNfc;
  }

  constructor(
    @Inject(DIALOG_DATA) protected data: AuthResponse<TwoFactorYubiKeyResponse>,
    apiService: ApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService,
    private formBuilder: FormBuilder,
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

  ngOnInit() {
    this.auth(this.data);
    this.formGroup = this.formBuilder.group({
      formKeys: this.formBuilder.array<Key>([]),
      anyKeyHasNfc: this.formBuilder.control(this.anyKeyHasNfc),
    });
    this.refreshFormArrayData();
  }

  refreshFormArrayData() {
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
    const keys = this.formGroup.controls.formKeys.value;
    const request = await this.buildRequestModel(UpdateTwoFactorYubikeyOtpRequest);
    request.key1 = keys != null && keys.length > 0 ? keys[0].key : null;
    request.key2 = keys != null && keys.length > 1 ? keys[1].key : null;
    request.key3 = keys != null && keys.length > 2 ? keys[2].key : null;
    request.key4 = keys != null && keys.length > 3 ? keys[3].key : null;
    request.key5 = keys != null && keys.length > 4 ? keys[4].key : null;
    request.nfc = this.formGroup.value.anyKeyHasNfc;

    this.processResponse(await this.apiService.putTwoFactorYubiKey(request));
    this.refreshFormArrayData();
    this.toastService.showToast({
      title: this.i18nService.t("success"),
      message: this.i18nService.t("yubikeysUpdated"),
      variant: "success",
    });
    this.onUpdated.emit(this.enabled);
  }

  remove(pos: number) {
    this.keys[pos].key = null;
    this.keys[pos].existingKey = null;

    this.keysFormControl[pos].setValue({
      existingKey: null,
      key: null,
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
    return dialogService.open<boolean>(TwoFactorSetupYubiKeyComponent, config);
  }
}
