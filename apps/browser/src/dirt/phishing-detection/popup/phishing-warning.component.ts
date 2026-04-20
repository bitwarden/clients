import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { BrowserApi } from "@bitwarden/browser/platform/browser/browser-api";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
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

export class PhishingWarning implements OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private messageSender = inject(MessageSender);
  private eventCollectionService = inject(EventCollectionService);
  private organizationService = inject(OrganizationService);
  private accountService = inject(AccountService);

  private readonly phishingUrl = toSignal(
    this.activatedRoute.queryParamMap.pipe(map((params) => params.get("phishingUrl") || "")),
    { initialValue: "" },
  );
  protected readonly phishingHostname = computed(() => {
    const url = this.phishingUrl();
    return url ? new URL(url).hostname : "";
  });

  async ngOnInit() {
    await this.recordEvents(EventType.PhishingBlocker_SiteAccessed, false);
  }

  async closeTab() {
    await this.recordEvents(EventType.PhishingBlocker_SiteExited, false);
    const tabId = await this.getTabId();
    this.messageSender.send(PHISHING_DETECTION_CANCEL_COMMAND, { tabId });
  }

  async continueAnyway() {
    await this.recordEvents(EventType.PhishingBlocker_Bypassed, true);
    const url = this.phishingUrl();
    const tabId = await this.getTabId();
    this.messageSender.send(PHISHING_DETECTION_CONTINUE_COMMAND, { tabId, url });
  }

  private async recordEvents(eventType: EventType, uploadImmediately: boolean): Promise<void> {
    try {
      const orgs = await this.getOrgsToNotify();

      // keep this sequential, using a Promise.all causes a race condition
      for (const org of orgs) {
        await this.eventCollectionService.collect(eventType, undefined, uploadImmediately, org.id);
      }
    } catch {
      // Event collection failure should not block the user action
    }
  }

  private async getOrgsToNotify(): Promise<Organization[]> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const orgs = await firstValueFrom(this.organizationService.organizations$(userId));
    return orgs.filter((o) => o.useEvents && o.usePhishingBlocker);
  }

  private async getTabId() {
    return BrowserApi.getCurrentTab()?.then((tab) => tab.id);
  }
}
