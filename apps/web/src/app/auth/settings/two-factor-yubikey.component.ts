import { Component } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { UpdateTwoFactorYubioOtpRequest } from "@bitwarden/common/auth/models/request/update-two-factor-yubio-otp.request";
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
  type = TwoFactorProviderType.Yubikey;
  keys: Key[];
  nfc = false;

  formPromise: Promise<TwoFactorYubiKeyResponse>;
  disablePromise: Promise<unknown>;

  override componentName = "app-two-factor-yubikey";

  constructor(
    apiService: ApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService
  ) {
    super(
      apiService,
      i18nService,
      platformUtilsService,
      logService,
      userVerificationService,
      dialogService
    );
  }

  auth(authResponse: AuthResponse<TwoFactorYubiKeyResponse>) {
    super.auth(authResponse);
    this.processResponse(authResponse.response);
  }

  async submit() {
    const request = await this.buildRequestModel(UpdateTwoFactorYubioOtpRequest);
    request.key1 = this.keys != null && this.keys.length > 0 ? this.keys[0].key : null;
    request.key2 = this.keys != null && this.keys.length > 1 ? this.keys[1].key : null;
    request.key3 = this.keys != null && this.keys.length > 2 ? this.keys[2].key : null;
    request.key4 = this.keys != null && this.keys.length > 3 ? this.keys[3].key : null;
    request.key5 = this.keys != null && this.keys.length > 4 ? this.keys[4].key : null;
    request.nfc = this.nfc;

    return super.enable(async () => {
      this.formPromise = this.apiService.putTwoFactorYubiKey(request);
      const response = await this.formPromise;
      await this.processResponse(response);
      this.platformUtilsService.showToast("success", null, this.i18nService.t("yubikeysUpdated"));
    });
  }

  disable() {
    return super.disable(this.disablePromise);
  }

  remove(key: Key) {
    key.existingKey = null;
    key.key = null;
  }

  private processResponse(response: TwoFactorYubiKeyResponse) {
    this.enabled = response.enabled;
    this.keys = [
      { key: response.key1, existingKey: this.padRight(response.key1) },
      { key: response.key2, existingKey: this.padRight(response.key2) },
      { key: response.key3, existingKey: this.padRight(response.key3) },
      { key: response.key4, existingKey: this.padRight(response.key4) },
      { key: response.key5, existingKey: this.padRight(response.key5) },
    ];
    this.nfc = response.nfc || !response.enabled;
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
}
