// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventResponse } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { EventService, BaseEventsComponent } from "@bitwarden/web-vault/app/dirt/event-logs";
import { EventExportService } from "@bitwarden/web-vault/app/tools/event-export";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "provider-events",
  templateUrl: "events.component.html",
  standalone: false,
})
export class EventsComponent extends BaseEventsComponent implements OnInit {
  exportFileName = "provider-events";
  providerId: string;

  private providerUsersUserIdMap = new Map<string, any>();
  private providerUsersIdMap = new Map<string, any>();
  // Maps a provider-organization relationship id (EventResponse.providerOrganizationId) to the
  // client organization's display name.
  private providerOrganizationNameMap = new Map<string, string>();

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    eventService: EventService,
    i18nService: I18nService,
    private providerService: ProviderService,
    private providerApiService: ProviderApiServiceAbstraction,
    exportService: EventExportService,
    platformUtilsService: PlatformUtilsService,
    private router: Router,
    logService: LogService,
    private userNamePipe: UserNamePipe,
    fileDownloadService: FileDownloadService,
    toastService: ToastService,
    accountService: AccountService,
    organizationService: OrganizationService,
    private configService: ConfigService,
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
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      this.providerId = params.providerId;
      const provider = await firstValueFrom(
        this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) => this.providerService.get$(this.providerId, userId)),
        ),
      );

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
    this.initBase();
    const response = await this.apiService.getProviderUsers(this.providerId);
    response.data.forEach((u) => {
      const name = this.userNamePipe.transform(u);
      this.providerUsersIdMap.set(u.id, { name: name, email: u.email });
      this.providerUsersUserIdMap.set(u.userId, { name: name, email: u.email });
    });

    // Only needed to personalize event copy with the client org name, which is gated behind this
    // flag, so skip the extra request entirely when it's off.
    if (await this.configService.getFeatureFlag(FeatureFlag.VFO1Foundation)) {
      const providerOrganizations = await this.providerApiService.getProviderOrganizations(
        this.providerId,
      );
      providerOrganizations.data.forEach((o) => {
        this.providerOrganizationNameMap.set(o.id, o.organizationName);
      });
    }

    await this.refreshEvents();
    this.loaded.set(true);
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

  protected override getOrganizationName(r: EventResponse): string | undefined {
    return r.providerOrganizationId
      ? this.providerOrganizationNameMap.get(r.providerOrganizationId)
      : undefined;
  }
}
