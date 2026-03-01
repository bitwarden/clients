import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  SvgModule,
  IconTileComponent,
  LinkModule,
  CalloutComponent,
  TypographyModule,
} from "@bitwarden/components";
import { MessageSender } from "@bitwarden/messaging";

import {
  PHISHING_DETECTION_CANCEL_COMMAND,
  PHISHING_DETECTION_CONTINUE_COMMAND,
} from "../services/phishing-detection.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "dirt-phishing-warning",
  standalone: true,
  templateUrl: "phishing-warning.component.html",
  imports: [
    CommonModule,
    SvgModule,
    JslibModule,
    LinkModule,
    FormFieldModule,
    AsyncActionsModule,
    CheckboxModule,
    ButtonModule,
    RouterModule,
    IconTileComponent,
    CalloutComponent,
    TypographyModule,
  ],
})
// FIXME(https://bitwarden.atlassian.net/browse/PM-28231): Use Component suffix
// eslint-disable-next-line @angular-eslint/component-class-suffix
export class PhishingWarning {
  private activatedRoute = inject(ActivatedRoute);
  private messageSender = inject(MessageSender);

  private phishingUrl$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => {
      const encoded = params.get("phishingUrl");
      if (!encoded) {
        return "";
      }
      try {
        return decodeURIComponent(encoded);
      } catch {
        return encoded;
      }
    }),
  );
  private tabId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => {
      const tabIdParam = params.get("tabId");
      if (!tabIdParam) {
        return undefined;
      }
      const parsed = parseInt(tabIdParam, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    }),
  );
  protected phishingHostname$ = this.phishingUrl$.pipe(map((url) => new URL(url).hostname));

  async closeTab() {
    const tabId = await firstValueFrom(this.tabId$);
    if (tabId === undefined) {
      return;
    }
    this.messageSender.send(PHISHING_DETECTION_CANCEL_COMMAND, { tabId });
  }

  async continueAnyway() {
    const url = await firstValueFrom(this.phishingUrl$);
    const tabId = await firstValueFrom(this.tabId$);
    if (tabId === undefined) {
      return;
    }
    this.messageSender.send(PHISHING_DETECTION_CONTINUE_COMMAND, { tabId, url });
  }
}
