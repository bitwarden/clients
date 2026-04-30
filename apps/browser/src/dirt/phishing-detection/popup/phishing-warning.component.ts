import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { BrowserApi } from "@bitwarden/browser/platform/browser/browser-api";
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
import { I18nPipe } from "@bitwarden/ui-common";

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
    LinkModule,
    FormFieldModule,
    AsyncActionsModule,
    CheckboxModule,
    ButtonModule,
    RouterModule,
    IconTileComponent,
    CalloutComponent,
    TypographyModule,
    I18nPipe,
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
    this.messageSender.send(PHISHING_DETECTION_CANCEL_COMMAND, { tabId });
  }

  async continueAnyway() {
    const url = await firstValueFrom(this.phishingUrl$);
    const tabId = await this.getTabId();
    this.messageSender.send(PHISHING_DETECTION_CONTINUE_COMMAND, { tabId, url });
  }

  private async getTabId() {
    return BrowserApi.getCurrentTab()?.then((tab) => tab.id);
  }
}
