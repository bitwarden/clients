import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { map } from "rxjs";

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

@Component({
  selector: "dirt-phishing-warning",
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class PhishingWarningComponent {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly messageSender = inject(MessageSender);

  private readonly phishingUrl = toSignal(
    this.activatedRoute.queryParamMap.pipe(map((params) => params.get("phishingUrl") || "")),
    { initialValue: "" },
  );
  protected readonly phishingHostname = computed(() => {
    const url = this.phishingUrl();
    return url ? new URL(url).hostname : "";
  });

  async closeTab() {
    const tabId = await this.getTabId();
    this.messageSender.send(PHISHING_DETECTION_CANCEL_COMMAND, { tabId });
  }

  async continueAnyway() {
    const url = this.phishingUrl();
    const tabId = await this.getTabId();
    this.messageSender.send(PHISHING_DETECTION_CONTINUE_COMMAND, { tabId, url });
  }

  private async getTabId() {
    return BrowserApi.getCurrentTab()?.then((tab) => tab.id);
  }
}
