import { CommonModule } from "@angular/common";
import { Component, Inject, NgZone } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { WebAuthnChallengeResponse } from "@bitwarden/common/auth/models/response/web-authn-challenge.response";
import { TwoFactorService, TwoFactorSetupDialogData } from "@bitwarden/common/auth/two-factor";
import { TwoFactorWebAuthnChallengeRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-web-authn-challenge.request";
import { TwoFactorWebAuthnDeleteAllRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-web-authn-delete-all.request";
import { TwoFactorWebAuthnDeleteRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-web-authn-delete.request";
import { TwoFactorWebAuthnUpdateRequest } from "@bitwarden/common/auth/two-factor/request/two-factor-web-authn-update.request";
import { TwoFactorWebAuthnChallengeResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-web-authn-challenge.response";
import { TwoFactorWebAuthnDeleteResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-web-authn-delete.response";
import { TwoFactorWebAuthnDetailsResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-web-authn-details.response";
import { TwoFactorWebAuthnResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-web-authn.response";
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
  LinkModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { TwoFactorSetupMethodBaseComponent } from "./two-factor-setup-method-base.component";

interface Key {
  id: number;
  name: string;
  configured: boolean;
  migrated?: boolean;
  removePromise: Promise<TwoFactorWebAuthnDeleteResponse> | null;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-two-factor-setup-webauthn",
  templateUrl: "two-factor-setup-webauthn.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    CommonModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    IconModule,
    JslibModule,
    LinkModule,
    ReactiveFormsModule,
    TypographyModule,
  ],
})
export class TwoFactorSetupWebAuthnComponent extends TwoFactorSetupMethodBaseComponent {
  type = TwoFactorProviderType.WebAuthn;
  name: string = "";
  keys: Key[] = [];
  keyIdAvailable: number | null = null;
  keysConfiguredCount = 0;
  webAuthnError: boolean = false;
  webAuthnListening: boolean = false;
  webAuthnResponse: PublicKeyCredential | null = null;
  challengePromise: Promise<TwoFactorWebAuthnChallengeResponse> | undefined;
  private userVerificationToken: string | undefined;

  private requireUserVerificationToken(): string {
    if (this.userVerificationToken === undefined) {
      throw new Error("User verification token is missing");
    }
    return this.userVerificationToken;
  }

  override componentName = "app-two-factor-webauthn";

  protected formGroup: FormGroup;

  constructor(
    @Inject(DIALOG_DATA) protected data: TwoFactorSetupDialogData<TwoFactorWebAuthnResponse>,
    private dialogRef: DialogRef,
    twoFactorService: TwoFactorService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    private ngZone: NgZone,
    logService: LogService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService,
    toastService: ToastService,
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
    this.formGroup = new FormGroup({
      name: new FormControl({ value: "", disabled: false }, Validators.required),
    });
    this.auth(data);
  }

  auth(authResponse: TwoFactorSetupDialogData<TwoFactorWebAuthnResponse>) {
    super.auth(authResponse);
    this.processGetResponse(authResponse.response);
  }

  submit = async () => {
    if (this.webAuthnResponse == null || this.keyIdAvailable == null) {
      // Should never happen.
      return Promise.reject();
    }
    return this.enable();
  };

  protected async enable() {
    if (this.webAuthnResponse == undefined || this.keyIdAvailable == undefined) {
      throw new Error("WebAuthn response or key ID is missing");
    }

    const request = new TwoFactorWebAuthnUpdateRequest(
      this.webAuthnResponse,
      this.formGroup.value.name || "",
      this.keyIdAvailable,
      this.requireUserVerificationToken(),
    );

    const response = await this.twoFactorService.putTwoFactorWebAuthn(request);
    this.applyWebAuthnDetails(response.webAuthn);
    this.toastService.showToast({
      title: this.i18nService.t("success"),
      message: this.i18nService.t("twoFactorProviderEnabled"),
      variant: "success",
    });
    this.onUpdated.emit(response.webAuthn.enabled);
  }

  disable = async () => {
    await this.disableMethod();
    if (!this.enabled) {
      this.onUpdated.emit(this.enabled);
      await this.dialogRef.close();
    }
  };

  protected override async disableMethod() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "disable" },
      content: { key: "twoStepDisableDesc" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    // Server's per-credential DELETE refuses to remove the last registered credential
    // (lockout-prevention), so the only path to delete the WebAuthn enrollment entirely is the
    // bulk endpoint.
    const request = new TwoFactorWebAuthnDeleteAllRequest(this.requireUserVerificationToken());
    await this.twoFactorService.deleteTwoFactorWebAuthnAll(request);
    this.enabled = false;
    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("twoStepDisabled"),
    });
    this.onUpdated.emit(false);
  }

  async remove(key: Key) {
    if (this.keysConfiguredCount <= 1 || key.removePromise != null) {
      return;
    }
    const name = key.name != null ? key.name : this.i18nService.t("webAuthnkeyX", key.id as any);

    const confirmed = await this.dialogService.openSimpleDialog({
      title: name,
      content: { key: "removeU2fConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }
    const request = new TwoFactorWebAuthnDeleteRequest(key.id, this.requireUserVerificationToken());
    try {
      key.removePromise = this.twoFactorService.deleteTwoFactorWebAuthn(request);
      const response = await key.removePromise;
      key.removePromise = null;
      this.applyWebAuthnDetails(response.webAuthn);
    } catch (e) {
      this.logService.error(e);
    }
  }

  readKey = async () => {
    if (this.keyIdAvailable == null) {
      return;
    }
    const request = new TwoFactorWebAuthnChallengeRequest(this.requireUserVerificationToken());
    this.challengePromise = this.twoFactorService.getTwoFactorWebAuthnChallenge(request);
    const wrappedChallenge = await this.challengePromise;
    if (wrappedChallenge.options == null) {
      this.webAuthnError = true;
      return;
    }
    this.readDevice(wrappedChallenge.options);
  };

  private readDevice(webAuthnChallenge: WebAuthnChallengeResponse) {
    // eslint-disable-next-line
    console.log("listening for key...");
    this.resetWebAuthn(true);

    navigator.credentials
      .create({
        publicKey: webAuthnChallenge,
      })
      .then((data) => {
        this.ngZone.run(() => {
          this.webAuthnListening = false;
          this.webAuthnResponse = data as PublicKeyCredential;
        });
      })
      .catch((err) => {
        // eslint-disable-next-line
        console.error(err);
        this.resetWebAuthn(false);
        // TODO: Should we display the actual error?
        this.webAuthnError = true;
      });
  }

  private resetWebAuthn(listening = false) {
    this.webAuthnResponse = null;
    this.webAuthnError = false;
    this.webAuthnListening = listening;
  }

  private findNextAvailableKeyId(existingIds: Set<number>): number {
    // Search for first gap, bounded by current key count + 1
    for (let i = 1; i <= existingIds.size + 1; i++) {
      if (!existingIds.has(i)) {
        return i;
      }
    }

    // This should never be reached due to loop bounds, but TypeScript requires a return
    throw new Error("Unable to find next available key ID");
  }

  private processGetResponse(response: TwoFactorWebAuthnResponse) {
    this.userVerificationToken = response.userVerificationToken;
    this.applyWebAuthnDetails(response.webAuthn);
  }

  private applyWebAuthnDetails(webAuthnDetails: TwoFactorWebAuthnDetailsResponse) {
    if (!webAuthnDetails.keys || webAuthnDetails.keys.length === 0) {
      webAuthnDetails.keys = [];
    }
    this.resetWebAuthn();
    this.keys = [];
    this.keyIdAvailable = null;
    const nameControl = this.formGroup.get("name");
    if (nameControl) {
      nameControl.enable();
      nameControl.setValue("");
    }
    this.keysConfiguredCount = 0;

    // Build configured keys
    for (const key of webAuthnDetails.keys) {
      this.keysConfiguredCount++;
      this.keys.push({
        id: key.id,
        name: key.name,
        configured: true,
        migrated: key.migrated,
        removePromise: null,
      });
    }

    // [PM-20109]: To accommodate the existing form logic with minimal changes,
    // we need to have at least one unconfigured key slot available to the collection.
    // Prior to PM-20109, both client and server had hard checks for IDs <= 5.
    // While we don't have any technical constraints _at this time_, we should avoid
    // unbounded growth of key IDs over time as users add/remove keys;
    // this strategy gap-fills key IDs.
    const existingIds = new Set(webAuthnDetails.keys.map((k) => k.id));
    const nextId = this.findNextAvailableKeyId(existingIds);

    // Add unconfigured slot, which can be used to add a new key
    this.keys.push({
      id: nextId,
      name: "",
      configured: false,
      removePromise: null,
    });
    this.keyIdAvailable = nextId;

    this.enabled = webAuthnDetails.enabled;
    this.onUpdated.emit(this.enabled);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<TwoFactorSetupDialogData<TwoFactorWebAuthnResponse>>,
  ) {
    return dialogService.open<boolean, TwoFactorSetupDialogData<TwoFactorWebAuthnResponse>>(
      TwoFactorSetupWebAuthnComponent,
      config as DialogConfig<TwoFactorSetupDialogData<TwoFactorWebAuthnResponse>, boolean>,
    );
  }
}
