// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, OnDestroy } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, filter, map, Observable, Subject, switchMap, takeUntil } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventResponse } from "@bitwarden/common/models/response/event.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { EventView } from "@bitwarden/common/models/view/event.view";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { EventOptions, EventService } from "../../core";
import { EventExportService } from "../../tools/event-export";

@Directive()
export abstract class BaseEventsComponent implements OnDestroy {
  loading = true;
  loaded = false;
  events: EventView[];
  dirtyDates = true;
  continuationToken: string;
  canUseSM = false;

  abstract readonly exportFileName: string;

  protected eventsForm = new FormGroup({
    start: new FormControl(null),
    end: new FormControl(null),
  });

  protected canUseSM$: Observable<boolean>;
  protected activeOrganization$: Observable<Organization | undefined>;
  protected organizations$: Observable<Organization[]>;
  private destroySubject$ = new Subject<void>();

  protected get destroy$(): Observable<void> {
    return this.destroySubject$.asObservable();
  }

  constructor(
    protected eventService: EventService,
    protected i18nService: I18nService,
    protected exportService: EventExportService,
    protected platformUtilsService: PlatformUtilsService,
    protected logService: LogService,
    protected fileDownloadService: FileDownloadService,
    private toastService: ToastService,
    protected activeRoute: ActivatedRoute,
    protected accountService: AccountService,
    protected organizationService: OrganizationService,
  ) {
    const defaultDates = this.eventService.getDefaultDateFilters();
    this.start = defaultDates[0];
    this.end = defaultDates[1];
  }

  protected initBase(): void {
    this.organizations$ = this.accountService.activeAccount$.pipe(
      filter((account): account is Account => !!account?.id),
      switchMap((account) => this.organizationService.organizations$(account.id)),
    );

    this.activeOrganization$ = combineLatest([this.activeRoute.paramMap, this.organizations$]).pipe(
      map(([params, orgs]) => orgs.find((org) => org.id === params.get("organizationId"))),
    );

    this.canUseSM$ = this.activeOrganization$.pipe(
      map((org) => org?.canAccessSecretsManager ?? false),
    );

    this.canUseSM$.pipe(takeUntil(this.destroy$)).subscribe((value) => {
      this.canUseSM = value;
    });
  }

  ngOnDestroy(): void {
    this.destroySubject$.next();
    this.destroySubject$.complete();
  }

  get start(): string {
    return this.eventsForm.value.start;
  }

  set start(val: string) {
    this.eventsForm.get("start").setValue(val);
  }

  get end(): string {
    return this.eventsForm.value.end;
  }

  set end(val: string) {
    this.eventsForm.get("end").setValue(val);
  }

  loadMoreEvents = async () => {
    await this.loadEvents(false);
  };

  refreshEvents = async () => {
    await this.loadEvents(true);
  };

  exportEvents = async () => {
    if (this.dirtyDates) {
      return;
    }

    this.loading = true;

    const dates = this.parseDates();
    if (dates == null) {
      return;
    }

    let promise: Promise<any>;
    try {
      promise = this.export(dates[0], dates[1]);
      await promise;
    } catch (e) {
      this.logService.error(`Handled exception: ${e}`);
    }

    promise = null;
    this.loading = false;
  };

  loadEvents = async (clearExisting: boolean) => {
    const dates = this.parseDates();
    if (dates == null) {
      return;
    }

    this.loading = true;
    let events: EventView[] = [];
    let promise: Promise<any>;
    promise = this.loadAndParseEvents(
      dates[0],
      dates[1],
      clearExisting ? null : this.continuationToken,
    );

    const result = await promise;
    this.continuationToken = result.continuationToken;
    events = result.events;

    if (!clearExisting && this.events != null && this.events.length > 0) {
      this.events = this.events.concat(events);
    } else {
      this.events = events;
    }

    this.dirtyDates = false;
    this.loading = false;
    promise = null;
  };

  protected abstract requestEvents(
    startDate: string,
    endDate: string,
    continuationToken: string,
  ): Promise<ListResponse<EventResponse>>;
  protected abstract getUserName(r: EventResponse, userId: string): { name: string; email: string };

  protected async loadAndParseEvents(
    startDate: string,
    endDate: string,
    continuationToken: string,
  ) {
    const response = await this.requestEvents(startDate, endDate, continuationToken);

    const events = await Promise.all(
      response.data.map(async (r) => {
        const userId = r.actingUserId == null ? r.userId : r.actingUserId;
        const options = new EventOptions();
        options.disableLink = !this.canUseSM;

        const eventInfo = await this.eventService.getEventInfo(r, options);
        const user = this.getUserName(r, userId);
        const userName = user != null ? user.name : this.i18nService.t("unknown");

        return new EventView({
          message: eventInfo.message,
          humanReadableMessage: eventInfo.humanReadableMessage,
          appIcon: eventInfo.appIcon,
          appName: eventInfo.appName,
          userId: userId,
          userName: userName,
          userEmail: user != null ? user.email : "",
          date: r.date,
          ip: r.ipAddress,
          type: r.type,
          installationId: r.installationId,
          systemUser: r.systemUser,
          serviceAccountId: r.serviceAccountId,
        });
      }),
    );
    return { continuationToken: response.continuationToken, events: events };
  }

  protected parseDates() {
    let dates: string[] = null;
    try {
      dates = this.eventService.formatDateFilters(this.start, this.end);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidDateRange"),
      });
      return null;
    }
    return dates;
  }

  private async export(start: string, end: string) {
    let continuationToken = this.continuationToken;
    let events = [].concat(this.events);

    while (continuationToken != null) {
      const result = await this.loadAndParseEvents(start, end, continuationToken);
      continuationToken = result.continuationToken;
      events = events.concat(result.events);
    }

    const data = await this.exportService.getEventExport(events);
    const fileName = this.exportService.getFileName(this.exportFileName, "csv");
    this.fileDownloadService.download({
      fileName,
      blobData: data,
      blobOptions: { type: "text/plain" },
    });
  }
}
