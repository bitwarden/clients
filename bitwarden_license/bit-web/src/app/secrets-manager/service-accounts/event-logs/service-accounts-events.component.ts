// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { BaseEventsComponent } from "@bitwarden/web-vault/app/admin-console/common/base.events.component";
import { EventService } from "@bitwarden/web-vault/app/core";
import { EventExportService } from "@bitwarden/web-vault/app/tools/event-export";

import { ServiceAccountEventLogApiService } from "./service-account-event-log-api.service";

@Component({
  selector: "sm-service-accounts-events",
  templateUrl: "./service-accounts-events.component.html",
})
export class ServiceAccountEventsComponent
  extends BaseEventsComponent
  implements OnInit, OnDestroy
{
  exportFileName = "machine-account-events";
  private destroy$ = new Subject<void>();
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
