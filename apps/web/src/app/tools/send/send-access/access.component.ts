// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";

import { SendAccessToken } from "@bitwarden/common/auth/send-access";

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
  readonly viewState = signal<SendViewState | null>(SendViewState.Auth);
  readonly id = signal<string>("");
  readonly key = signal<string>("");

  readonly sendAccessToken = signal<SendAccessToken | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly destroyRef: DestroyRef,
  ) {}

  ngOnInit() {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.id.set(params.sendId);
      this.key.set(params.key);

      // when pasting sequential Send URLs into the browser,
      // Angular reuses the SendAuthComponent instance
      // Reset state so child components are recreated with fresh data
      this.sendAccessToken.set(null);

      // Temporarily set viewState to null to destroy the current child component,
      // then set it back to Auth on the next tick to recreate it with the new id/key.
      this.viewState.set(null);
      setTimeout(() => this.viewState.set(SendViewState.Auth));
    });
  }

  onAuthRequired() {
    this.viewState.set(SendViewState.Auth);
  }

  onAccessGranted(event: { accessToken: SendAccessToken }) {
    this.sendAccessToken.set(event.accessToken);
    this.viewState.set(SendViewState.View);
  }
}
