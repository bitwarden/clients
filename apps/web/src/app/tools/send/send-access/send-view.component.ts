import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  input,
  OnInit,
  output,
} from "@angular/core";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendAccess } from "@bitwarden/common/tools/send/models/domain/send-access";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { AnonLayoutWrapperDataService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../shared";

import { SendAccessFileComponent } from "./send-access-file.component";
import { SendAccessTextComponent } from "./send-access-text.component";

@Component({
  selector: "app-send-view",
  templateUrl: "send-view.component.html",
  imports: [SendAccessFileComponent, SendAccessTextComponent, SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendViewComponent implements OnInit {
  readonly id = input.required<string>();
  readonly key = input.required<string>();
  readonly sendResponse = input<SendAccessResponse | null>(null);
  readonly accessRequest = input<SendAccessRequest>(new SendAccessRequest());

  authRequired = output<void>();

  send: SendAccessView | null = null;
  sendType = SendType;
  loading = true;
  unavailable = false;
  error = false;
  hideEmail = false;
  decKey!: SymmetricCryptoKey;

  constructor(
    private keyService: KeyService,
    private sendApiService: SendApiService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private layoutWrapperDataService: AnonLayoutWrapperDataService,
    private cdRef: ChangeDetectorRef,
  ) {}

  get expirationDate() {
    if (this.send == null || this.send.expirationDate == null) {
      return null;
    }
    return this.send.expirationDate;
  }

  get creatorIdentifier() {
    if (this.send == null || this.send.creatorIdentifier == null) {
      return null;
    }
    return this.send.creatorIdentifier;
  }

  async ngOnInit() {
    await this.load();
  }

  private async load() {
    this.unavailable = false;
    this.error = false;
    this.hideEmail = false;
    this.loading = true;

    let response = this.sendResponse();

    try {
      if (!response) {
        response = await this.sendApiService.postSendAccess(this.id(), this.accessRequest());
      }

      const keyArray = Utils.fromUrlB64ToArray(this.key());
      const sendAccess = new SendAccess(response);
      this.decKey = await this.keyService.makeSendKey(keyArray);
      this.send = await sendAccess.decrypt(this.decKey);
    } catch (e) {
      if (e instanceof ErrorResponse) {
        if (e.statusCode === 401) {
          this.authRequired.emit();
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
      this.creatorIdentifier == null && !this.loading && !this.unavailable && !response;

    this.hideEmail = this.send != null && this.creatorIdentifier == null;

    if (this.creatorIdentifier != null) {
      this.layoutWrapperDataService.setAnonLayoutWrapperData({
        pageSubtitle: {
          key: "sendAccessCreatorIdentifier",
          placeholders: [this.creatorIdentifier],
        },
      });
    }

    this.cdRef.markForCheck();
  }
}
