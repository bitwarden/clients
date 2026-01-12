// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";

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
