import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  OnInit,
  output,
  signal,
} from "@angular/core";

import { SendAccessToken } from "@bitwarden/common/auth/send-access";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendAccess } from "@bitwarden/common/tools/send/models/domain/send-access";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import {
  AnonLayoutWrapperDataService,
  SpinnerComponent,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../shared";

import { SendAccessFileComponent } from "./send-access-file.component";
import { SendAccessTextComponent } from "./send-access-text.component";

@Component({
  selector: "app-send-view",
  templateUrl: "send-view.component.html",
  imports: [SendAccessFileComponent, SendAccessTextComponent, SharedModule, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendViewComponent implements OnInit {
  readonly id = input.required<string>();
  readonly key = input.required<string>();
  readonly accessToken = input<SendAccessToken | null>(null);
  readonly sendResponse = input<SendAccessResponse | null>(null);
  readonly accessRequest = input<SendAccessRequest>(new SendAccessRequest());

  authRequired = output<void>();

  readonly send = signal<SendAccessView | null>(null);
  readonly expirationDate = computed<Date | null>(() => this.send()?.expirationDate ?? null);
  readonly creatorIdentifier = computed<string | null>(
    () => this.send()?.creatorIdentifier ?? null,
  );
  readonly hideEmail = computed<boolean>(
    () => this.send() != null && this.creatorIdentifier() == null,
  );
  readonly loading = signal<boolean>(false);
  readonly unavailable = signal<boolean>(false);
  readonly error = signal<boolean>(false);

  sendType = SendType;
  decKey!: SymmetricCryptoKey;

  constructor(
    private keyService: KeyService,
    private sendApiService: SendApiService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private layoutWrapperDataService: AnonLayoutWrapperDataService,
    private configService: ConfigService,
  ) {}

  ngOnInit() {
    this.layoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: { key: "sendAccessContentTitle" },
    });
    void this.load();
  }

  private async load() {
    this.loading.set(true);
    this.unavailable.set(false);
    this.error.set(false);

    try {
      const sendEmailOtp = await this.configService.getFeatureFlag(FeatureFlag.SendEmailOTP);
      let response: SendAccessResponse;
      if (sendEmailOtp) {
        const accessToken = this.accessToken();
        if (!accessToken) {
          this.authRequired.emit();
          return;
        }
        response = await this.sendApiService.postSendAccessV2(accessToken);
      } else {
        const sendResponse = this.sendResponse();
        if (!sendResponse) {
          this.authRequired.emit();
          return;
        }
        response = sendResponse;
      }
      const keyArray = Utils.fromUrlB64ToArray(this.key());
      const sendAccess = new SendAccess(response);
      this.decKey = await this.keyService.makeSendKey(keyArray);
      const decSend = await sendAccess.decrypt(this.decKey);
      this.send.set(decSend);
    } catch (e) {
      this.send.set(null);
      if (e instanceof ErrorResponse) {
        if (e.statusCode === 401) {
          this.authRequired.emit();
        } else if (e.statusCode === 404) {
          this.unavailable.set(true);
        } else if (e.statusCode === 400) {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorOccurred"),
            message: e.message,
          });
        } else {
          this.error.set(true);
        }
      } else {
        this.error.set(true);
      }
    } finally {
      this.loading.set(false);
    }

    const creatorIdentifier = this.creatorIdentifier();
    if (creatorIdentifier != null) {
      this.layoutWrapperDataService.setAnonLayoutWrapperData({
        pageSubtitle: {
          key: "sendAccessCreatorIdentifier",
          placeholders: [creatorIdentifier],
        },
      });
    }
  }
}
