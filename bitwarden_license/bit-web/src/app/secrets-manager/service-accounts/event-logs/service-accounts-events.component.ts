// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { takeUntil } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { BaseEventsComponent } from "@bitwarden/web-vault/app/admin-console/common/base.events.component";
import { EventService } from "@bitwarden/web-vault/app/core";
import { EventExportService } from "@bitwarden/web-vault/app/tools/event-export";

import { ServiceAccountEventLogApiService } from "./service-account-event-log-api.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-service-accounts-events",
  templateUrl: "./service-accounts-events.component.html",
  standalone: false,
})
export class ServiceAccountEventsComponent
  extends BaseEventsComponent
  implements OnInit, OnDestroy
{
  exportFileName = "machine-account-events";
  private serviceAccountId: string;

  constructor(
    eventService: EventService,
    private serviceAccountEventsApiService: ServiceAccountEventLogApiService,
    private route: ActivatedRoute,
    i18nService: I18nService,
    exportService: EventExportService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    fileDownloadService: FileDownloadService,
    toastService: ToastService,
    protected organizationService: OrganizationService,
    protected accountService: AccountService,
  ) {
    super(
      eventService,
      i18nService,
      exportService,
      platformUtilsService,
      logService,
      fileDownloadService,
      toastService,
      route,
      accountService,
      organizationService,
    );
  }

  async ngOnInit() {
    this.initBase();
    // eslint-disable-next-line rxjs/no-async-subscribe
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(async (params) => {
      this.serviceAccountId = params.serviceAccountId;
      await this.load();
    });
  }

  async load() {
    await this.refreshEvents();
    this.loaded = true;
  }

  protected requestEvents(startDate: string, endDate: string, continuationToken: string) {
    return this.serviceAccountEventsApiService.getEvents(
      this.serviceAccountId,
      startDate,
      endDate,
      continuationToken,
    );
  }

  protected getUserName() {
    return {
      name: this.i18nService.t("machineAccount") + " " + this.serviceAccountId,
      email: "",
    };
  }
}
