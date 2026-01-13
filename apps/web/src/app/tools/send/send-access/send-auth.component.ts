import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";
import { SEND_KDF_ITERATIONS } from "@bitwarden/common/tools/send/send-kdf";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

import { SendAccessPasswordComponent } from "./send-access-password.component";

@Component({
  selector: "app-send-auth",
  templateUrl: "send-auth.component.html",
  imports: [SendAccessPasswordComponent, SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendAuthComponent {
  readonly id = input.required<string>();
  readonly key = input.required<string>();

  accessGranted = output<{
    response: SendAccessResponse;
    request: SendAccessRequest;
  }>();

  loading = false;
  error = false;
  unavailable = false;
  password?: string;

  private accessRequest!: SendAccessRequest;

  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private sendApiService: SendApiService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  async onSubmit(password: string) {
    this.password = password;
    this.loading = true;
    this.error = false;
    this.unavailable = false;

    try {
      const keyArray = Utils.fromUrlB64ToArray(this.key());
      this.accessRequest = new SendAccessRequest();

      const passwordHash = await this.cryptoFunctionService.pbkdf2(
        this.password,
        keyArray,
        "sha256",
        SEND_KDF_ITERATIONS,
      );
      this.accessRequest.password = Utils.fromBufferToB64(passwordHash);

      const sendResponse = await this.sendApiService.postSendAccess(this.id(), this.accessRequest);
      this.accessGranted.emit({ response: sendResponse, request: this.accessRequest });
    } catch (e) {
      if (e instanceof ErrorResponse) {
        if (e.statusCode === 404) {
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
    } finally {
      this.loading = false;
    }
  }
}
