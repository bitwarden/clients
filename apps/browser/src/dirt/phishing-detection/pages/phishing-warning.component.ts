// eslint-disable-next-line no-restricted-imports
import { CommonModule } from "@angular/common";
// eslint-disable-next-line no-restricted-imports
import { Component, inject } from "@angular/core";
// eslint-disable-next-line no-restricted-imports
import { ActivatedRoute, RouterModule } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BrowserApi } from "@bitwarden/browser/platform/browser/browser-api";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  IconModule,
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
    IconModule,
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
    map((params) => params.get("phishingUrl") || ""),
  );
  protected phishingHostname$ = this.phishingUrl$.pipe(map((url) => new URL(url).hostname));

  async closeTab() {
    const tabId = await this.getTabId();
    this.messageSender.send(PHISHING_DETECTION_CANCEL_COMMAND, {
      tabId,
    });
  }
  async continueAnyway() {
    const url = await firstValueFrom(this.phishingUrl$);
    const tabId = await this.getTabId();
    this.messageSender.send(PHISHING_DETECTION_CONTINUE_COMMAND, {
      tabId,
      url,
    });
  }

  private async getTabId() {
    return BrowserApi.getCurrentTab()?.then((tab) => tab.id);
  }
}
