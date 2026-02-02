// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";

import { SendAccessToken } from "@bitwarden/common/auth/send-access";
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

@Component({
  selector: "app-send-access",
  templateUrl: "access.component.html",
  imports: [SendAuthComponent, SendViewComponent, SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessComponent implements OnInit {
  readonly viewState = signal<SendViewState>(SendViewState.Auth);
  id: string;
  key: string;

  sendAccessToken: SendAccessToken | null = null;
  sendAccessResponse: SendAccessResponse | null = null;
  sendAccessRequest: SendAccessRequest = new SendAccessRequest();

  constructor(
    private route: ActivatedRoute,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit() {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.id = params.sendId;
      this.key = params.key;
    });
  }

  onAuthRequired() {
    this.viewState.set(SendViewState.Auth);
  }

  onAccessGranted(event: {
    response?: SendAccessResponse;
    request?: SendAccessRequest;
    accessToken?: SendAccessToken;
  }) {
    this.sendAccessResponse = event.response;
    this.sendAccessRequest = event.request;
    this.sendAccessToken = event.accessToken;
    this.viewState.set(SendViewState.View);
  }
}
