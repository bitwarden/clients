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
import { TwoFactorService, TwoFactorSetupDialogData } from "@bitwarden/common/auth/two-factor";
import { TwoFactorYubiKeyDeleteRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-yubikey-delete.request";
import { TwoFactorYubiKeyUpdateRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-yubikey-update.request";
import { TwoFactorYubiKeyDetailsResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-yubi-key-details.response";
import { TwoFactorYubiKeyResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-yubi-key.response";
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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
  private userVerificationToken: string | undefined;

  private requireUserVerificationToken(): string {
    if (this.userVerificationToken === undefined) {
      throw new Error("User verification token is missing");
    }
    return this.userVerificationToken;
  }

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
    @Inject(DIALOG_DATA) protected data: TwoFactorSetupDialogData<TwoFactorYubiKeyResponse>,
    twoFactorService: TwoFactorService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService,
    private formBuilder: FormBuilder,
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

  auth(authResponse: TwoFactorSetupDialogData<TwoFactorYubiKeyResponse>) {
    super.auth(authResponse);
    this.processGetResponse(authResponse.response);
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
    const request = new TwoFactorYubiKeyUpdateRequest(
      keys != null && keys.length > 0 ? (keys[0]?.key ?? "") : "",
      keys != null && keys.length > 1 ? (keys[1]?.key ?? "") : "",
      keys != null && keys.length > 2 ? (keys[2]?.key ?? "") : "",
      keys != null && keys.length > 3 ? (keys[3]?.key ?? "") : "",
      keys != null && keys.length > 4 ? (keys[4]?.key ?? "") : "",
      this.formGroup.value.anyKeyHasNfc ?? false,
      this.requireUserVerificationToken(),
    );

    const response = await this.twoFactorService.putTwoFactorYubiKey(request);
    this.applyYubiKeyDetails(response.yubiKey);
    this.refreshFormArrayData();
    this.toastService.showToast({
      title: this.i18nService.t("success"),
      message: this.i18nService.t("yubikeysUpdated"),
      variant: "success",
    });
    this.onUpdated.emit(this.enabled);
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

    const request = new TwoFactorYubiKeyDeleteRequest(this.requireUserVerificationToken());
    await this.twoFactorService.deleteTwoFactorYubiKey(request);
    this.enabled = false;
    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("twoStepDisabled"),
    });
    this.onUpdated.emit(false);
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

  private processGetResponse(response: TwoFactorYubiKeyResponse) {
    this.userVerificationToken = response.userVerificationToken;
    this.applyYubiKeyDetails(response.yubiKey);
  }

  private applyYubiKeyDetails(yubiKeyDetails: TwoFactorYubiKeyDetailsResponse) {
    this.enabled = yubiKeyDetails.enabled;
    this.anyKeyHasNfc = yubiKeyDetails.nfc || !yubiKeyDetails.enabled;
    this.keys = [
      { key: yubiKeyDetails.key1, existingKey: this.padRight(yubiKeyDetails.key1) },
      { key: yubiKeyDetails.key2, existingKey: this.padRight(yubiKeyDetails.key2) },
      { key: yubiKeyDetails.key3, existingKey: this.padRight(yubiKeyDetails.key3) },
      { key: yubiKeyDetails.key4, existingKey: this.padRight(yubiKeyDetails.key4) },
      { key: yubiKeyDetails.key5, existingKey: this.padRight(yubiKeyDetails.key5) },
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
    config: DialogConfig<TwoFactorSetupDialogData<TwoFactorYubiKeyResponse>>,
  ) {
    return dialogService.open<boolean, TwoFactorSetupDialogData<TwoFactorYubiKeyResponse>>(
      TwoFactorSetupYubiKeyComponent,
      config as DialogConfig<TwoFactorSetupDialogData<TwoFactorYubiKeyResponse>, boolean>,
    );
  }
}
