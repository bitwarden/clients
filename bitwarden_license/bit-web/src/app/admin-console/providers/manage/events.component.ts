// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { EventResponse } from "@bitwarden/common/models/response/event.response";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { BaseEventsComponent } from "@bitwarden/web-vault/app/admin-console/common/base.events.component";
import { EventService } from "@bitwarden/web-vault/app/core";
import { EventExportService } from "@bitwarden/web-vault/app/tools/event-export";

@Component({
  selector: "provider-events",
  templateUrl: "events.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class EventsComponent extends BaseEventsComponent implements OnInit {
  exportFileName = "provider-events";
  providerId: string;

  private providerUsersUserIdMap = new Map<string, any>();
  private providerUsersIdMap = new Map<string, any>();

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    eventService: EventService,
    i18nService: I18nService,
    private providerService: ProviderService,
    exportService: EventExportService,
    platformUtilsService: PlatformUtilsService,
    private router: Router,
    logService: LogService,
    private userNamePipe: UserNamePipe,
    fileDownloadService: FileDownloadService,
    toastService: ToastService,
  ) {
    super(
      eventService,
      i18nService,
      exportService,
      platformUtilsService,
      logService,
      fileDownloadService,
      toastService,
    );
  }

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      this.providerId = params.providerId;
      const provider = await this.providerService.get(this.providerId);
      if (provider == null || !provider.useEvents) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/providers", this.providerId]);
        return;
      }
      await this.load();
    });
  }

  async load() {
    const response = await this.apiService.getProviderUsers(this.providerId);
    response.data.forEach((u) => {
      const name = this.userNamePipe.transform(u);
      this.providerUsersIdMap.set(u.id, { name: name, email: u.email });
      this.providerUsersUserIdMap.set(u.userId, { name: name, email: u.email });
    });
    await this.refreshEvents();
    this.loaded = true;
  }

  protected requestEvents(startDate: string, endDate: string, continuationToken: string) {
    return this.apiService.getEventsProvider(
      this.providerId,
      startDate,
      endDate,
      continuationToken,
    );
  }

  protected getUserName(r: EventResponse, userId: string) {
    if (r.installationId != null) {
      return `Installation: ${r.installationId}`;
    }

    if (userId != null && this.providerUsersUserIdMap.has(userId)) {
      return this.providerUsersUserIdMap.get(userId);
    }

    return null;
  }
}
