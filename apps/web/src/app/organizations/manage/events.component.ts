import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ExportService } from "@bitwarden/common/abstractions/export.service";
import { FileDownloadService } from "@bitwarden/common/abstractions/fileDownload/fileDownload.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { ProviderServiceAbstraction } from "@bitwarden/common/abstractions/provider/provider.service.abstraction";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { EventResponse } from "@bitwarden/common/models/response/eventResponse";

import { BaseEventsComponent } from "../../common/base.events.component";
import { EventService } from "../../core";

@Component({
  selector: "app-org-events",
  templateUrl: "events.component.html",
})
export class EventsComponent extends BaseEventsComponent implements OnInit {
  exportFileName = "org-events";
  organizationId: string;
  organization: Organization;

  private orgUsersUserIdMap = new Map<string, any>();

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    eventService: EventService,
    i18nService: I18nService,
    exportService: ExportService,
    platformUtilsService: PlatformUtilsService,
    private router: Router,
    logService: LogService,
    private userNamePipe: UserNamePipe,
    private organizationService: OrganizationService,
    private providerService: ProviderServiceAbstraction,
    fileDownloadService: FileDownloadService
  ) {
    super(
      eventService,
      i18nService,
      exportService,
      platformUtilsService,
      logService,
      fileDownloadService
    );
  }

  async ngOnInit() {
    this.route.parent.parent.params.subscribe(async (params) => {
      this.organizationId = params.organizationId;
      this.organization = await this.organizationService.get(this.organizationId);
      if (this.organization == null || !this.organization.useEvents) {
        this.router.navigate(["/organizations", this.organizationId]);
        return;
      }

      await this.load();
    });
  }

  async load() {
    const response = await this.apiService.getOrganizationUsers(this.organizationId);
    response.data.forEach((u) => {
      const name = this.userNamePipe.transform(u);
      this.orgUsersUserIdMap.set(u.userId, { name: name, email: u.email });
    });

    if (this.organization.providerId != null) {
      try {
        const provider = await this.providerService.get(this.organization.providerId);
        if (
          provider != null &&
          (await this.providerService.get(this.organization.providerId)).canManageUsers
        ) {
          const providerUsersResponse = await this.apiService.getProviderUsers(
            this.organization.providerId
          );
          providerUsersResponse.data.forEach((u) => {
            const name = this.userNamePipe.transform(u);
            this.orgUsersUserIdMap.set(u.userId, {
              name: `${name} (${this.organization.providerName})`,
              email: u.email,
            });
          });
        }
      } catch (e) {
        this.logService.warning(e);
      }
    }

    await this.loadEvents(true);
    this.loaded = true;
  }

  protected requestEvents(startDate: string, endDate: string, continuationToken: string) {
    return this.apiService.getEventsOrganization(
      this.organizationId,
      startDate,
      endDate,
      continuationToken
    );
  }

  protected getUserName(r: EventResponse, userId: string) {
    if (userId == null) {
      return null;
    }

    if (this.orgUsersUserIdMap.has(userId)) {
      return this.orgUsersUserIdMap.get(userId);
    }

    if (r.providerId != null && r.providerId === this.organization.providerId) {
      return {
        name: this.organization.providerName,
      };
    }

    return null;
  }
}
