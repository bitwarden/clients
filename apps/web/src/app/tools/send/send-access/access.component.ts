// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendAccess } from "@bitwarden/common/tools/send/models/domain/send-access";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { SEND_KDF_ITERATIONS } from "@bitwarden/common/tools/send/send-kdf";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { AnonLayoutWrapperDataService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../shared";

import { SendAccessFileComponent } from "./send-access-file.component";
import { SendAccessPasswordComponent } from "./send-access-password.component";
import { SendAccessTextComponent } from "./send-access-text.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send-access",
  templateUrl: "access.component.html",
  imports: [
    SendAccessFileComponent,
    SendAccessTextComponent,
    SendAccessPasswordComponent,
    SharedModule,
  ],
})
export class AccessComponent implements OnInit {
  protected send: SendAccessView;
  protected sendType = SendType;
  protected loading = true;
  protected passwordRequired = false;
  protected formPromise: Promise<SendAccessResponse>;
  protected password: string;
  protected unavailable = false;
  protected error = false;
  protected hideEmail = false;
  protected decKey: SymmetricCryptoKey;
  protected accessRequest: SendAccessRequest;

  protected formGroup = this.formBuilder.group({});

  private id: string;
  private key: string;

  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private route: ActivatedRoute,
    private keyService: KeyService,
    private sendApiService: SendApiService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private layoutWrapperDataService: AnonLayoutWrapperDataService,
    protected formBuilder: FormBuilder,
    private accountService: AccountService,
  ) {}

  protected get expirationDate() {
    if (this.send == null || this.send.expirationDate == null) {
      return null;
    }
    return this.send.expirationDate;
  }

  protected get creatorIdentifier() {
    if (this.send == null || this.send.creatorIdentifier == null) {
      return null;
    }
    return this.send.creatorIdentifier;
  }

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.params.subscribe(async (params) => {
      this.id = params.sendId;
      this.key = params.key;
      if (this.key == null || this.id == null) {
        return;
      }
      await this.load();
    });
  }

  protected load = async () => {
    this.unavailable = false;
    this.error = false;
    this.hideEmail = false;
    try {
      const keyArray = Utils.fromUrlB64ToArray(this.key);
      this.accessRequest = new SendAccessRequest();
      if (this.password != null) {
        const passwordHash = await this.cryptoFunctionService.pbkdf2(
          this.password,
          keyArray,
          "sha256",
          SEND_KDF_ITERATIONS,
        );
        this.accessRequest.password = Utils.fromBufferToB64(passwordHash);
      }
      let sendResponse: SendAccessResponse = null;
      if (this.loading) {
        sendResponse = await this.sendApiService.postSendAccess(this.id, this.accessRequest);
      } else {
        this.formPromise = this.sendApiService.postSendAccess(this.id, this.accessRequest);
        sendResponse = await this.formPromise;
      }
      this.passwordRequired = false;
      const sendAccess = new SendAccess(sendResponse);
      this.decKey = await this.keyService.makeSendKey(keyArray);
      this.send = await sendAccess.decrypt(this.decKey);
    } catch (e) {
      if (e instanceof ErrorResponse) {
        if (e.statusCode === 401) {
          this.passwordRequired = true;
        } else if (e.statusCode === 404) {
          this.unavailable = true;
        } else if (e.statusCode === 400) {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorOccurred"),
            message: e.message,
          });
        } else {
          this.error = true;
        }
      } else {
        this.error = true;
      }
    }
    this.loading = false;
    this.hideEmail =
      this.creatorIdentifier == null &&
      !this.passwordRequired &&
      !this.loading &&
      !this.unavailable;

    if (this.creatorIdentifier != null) {
      this.layoutWrapperDataService.setAnonLayoutWrapperData({
        pageSubtitle: {
          key: "sendAccessCreatorIdentifier",
          placeholders: [this.creatorIdentifier],
        },
      });
    }
  };

  protected setPassword(password: string) {
    this.password = password;
  }
}
