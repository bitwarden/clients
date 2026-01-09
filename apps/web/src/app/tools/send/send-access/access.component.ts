// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendAccess } from "@bitwarden/common/tools/send/models/domain/send-access";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { SEND_KDF_ITERATIONS } from "@bitwarden/common/tools/send/send-kdf";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { AnonLayoutWrapperDataService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../shared";

import { SendAuthComponent } from "./send-auth.component";
import { SendViewComponent } from "./send-view.component";

const SendViewState = Object.freeze({
  View: "view",
  Auth: "auth",
} as const);
type SendViewState = (typeof SendViewState)[keyof typeof SendViewState];

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send-access",
  templateUrl: "access.component.html",
  imports: [SendAuthComponent, SendViewComponent, SharedModule],
})
export class AccessComponent implements OnInit {
  viewState: SendViewState = SendViewState.View;
  id: string;
  key: string;

  sendAccessResponse: SendAccessResponse | null = null;
  sendAccessRequest: SendAccessRequest = new SendAccessRequest();

  constructor(private route: ActivatedRoute) {}

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.params.subscribe(async (params) => {
      this.id = params.sendId;
      this.key = params.key;

      if (this.id && this.key) {
        this.viewState = SendViewState.View;
        this.sendAccessResponse = null;
        this.sendAccessRequest = new SendAccessRequest();
      }
    });
  }

  onAuthRequired() {
    this.viewState = SendViewState.Auth;
  }

  onAccessGranted(event: { response: SendAccessResponse; request: SendAccessRequest }) {
    this.sendAccessResponse = event.response;
    this.sendAccessRequest = event.request;
    this.viewState = SendViewState.View;
  }
}
