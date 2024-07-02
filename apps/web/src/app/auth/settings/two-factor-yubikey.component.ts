import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, EventEmitter, Inject, Output } from "@angular/core";
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
import { DialogService } from "@bitwarden/components";

import { TwoFactorBaseComponent } from "./two-factor-base.component";

interface Key {
  key: string;
  existingKey: string;
}

@Component({
  selector: "app-two-factor-yubikey",
  templateUrl: "two-factor-yubikey.component.html",
})
export class TwoFactorYubiKeyComponent extends TwoFactorBaseComponent {
  @Output() onChangeStatus = new EventEmitter<boolean>();
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
    private dialogRef: DialogRef,
    apiService: ApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService,
    private formBuilder: FormBuilder,
  ) {
    super(
      apiService,
      i18nService,
      platformUtilsService,
      logService,
      userVerificationService,
      dialogService,
    );
  }

  ngOnInit() {
    this.auth(this.data);
    this.formGroup = this.formBuilder.group({
      formKeys: this.formBuilder.array([] as Key[]),
      anyKeyHasNfc: this.formBuilder.control(this.anyKeyHasNfc),
    });
    this.patch();
  }

  patch() {
    const control = <FormArray>this.formGroup.get("formKeys");
    this.keys.forEach((val) => {
      const fb = this.formBuilder.group({
        key: val.key,
        existingKey: val.existingKey,
      });
      control.push(fb);
    });
  }

  auth(authResponse: AuthResponse<TwoFactorYubiKeyResponse>) {
    super.auth(authResponse);
    this.processResponse(authResponse.response);
  }

  submit = async () => {
    const request = await this.buildRequestModel(UpdateTwoFactorYubikeyOtpRequest);
    request.key1 = this.keysFormControl[0].value.key;
    request.key2 = this.keysFormControl[1].value.key;
    request.key3 = this.keysFormControl[2].value.key;
    request.key4 = this.keysFormControl[3].value.key;
    request.key5 = this.keysFormControl[4].value.key;
    request.nfc = this.anyKeyHasNfcFormControl.value;
    return this.submitForm(request);
  };

  private submitForm(request: UpdateTwoFactorYubikeyOtpRequest) {
    return super.enable(async () => {
      this.formPromise = this.apiService.putTwoFactorYubiKey(request);
      const response = await this.formPromise;
      this.processResponse(response);
      this.platformUtilsService.showToast("success", null, this.i18nService.t("yubikeysUpdated"));
    });
  }

  disable = async () => {
    await this.disableYubikey();
    if (!this.enabled) {
      this.onChangeStatus.emit(this.enabled);
      this.dialogRef.close();
    }
  };

  private async disableYubikey() {
    return super.disable(this.disablePromise);
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
    this.onChangeStatus.emit(this.enabled);

    this.keys = [
      { key: response.key1, existingKey: this.padRight(response.key1) },
      { key: response.key2, existingKey: this.padRight(response.key2) },
      { key: response.key3, existingKey: this.padRight(response.key3) },
      { key: response.key4, existingKey: this.padRight(response.key4) },
      { key: response.key5, existingKey: this.padRight(response.key5) },
    ];
    this.anyKeyHasNfc = response.nfc || !response.enabled;
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
    return dialogService.open<boolean>(TwoFactorYubiKeyComponent, config);
  }
}
