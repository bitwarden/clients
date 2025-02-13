// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { concatMap, firstValueFrom, lastValueFrom, Subject, takeUntil } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { EventSystemUser } from "@bitwarden/common/enums";
import { EventResponse } from "@bitwarden/common/models/response/event.response";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  ChangePlanDialogResultType,
  openChangePlanDialog,
} from "../../../billing/organizations/change-plan-dialog.component";
import { EventService } from "../../../core";
import { EventExportService } from "../../../tools/event-export";
import { BaseEventsComponent } from "../../common/base.events.component";

const EVENT_SYSTEM_USER_TO_TRANSLATION: Record<EventSystemUser, string> = {
  [EventSystemUser.SCIM]: null, // SCIM acronym not able to be translated so just display SCIM
  [EventSystemUser.DomainVerification]: "domainVerification",
  [EventSystemUser.PublicApi]: "publicApi",
};

@Component({
  selector: "app-org-events",
  templateUrl: "events.component.html",
})
export class EventsComponent extends BaseEventsComponent implements OnInit, OnDestroy {
  exportFileName = "org-events";
  organizationId: string;
  organization: Organization;
  sub: OrganizationSubscriptionResponse;
  userOrg: Organization;
  dummyEvents = [
    {
      timeStamp: this.getRandomDateTime(),
      deviceType: "Extension - Firefox",
      member: "Alice",
      event: "Logged in",
    },
    {
      timeStamp: this.getRandomDateTime(),
      deviceType: "Mobile - iOS",
      member: "Bob",
      event: "Viewed item 000000",
    },
    {
      timeStamp: this.getRandomDateTime(),
      deviceType: "Desktop - Linux",
      member: "Carlos",
      event: "Login attempt failed with incorrect password",
    },
    {
      timeStamp: this.getRandomDateTime(),
      deviceType: "Web vault - Chrome",
      member: "Ivan",
      event: "Confirmed user 000000",
    },
    {
      timeStamp: this.getRandomDateTime(),
      deviceType: "Mobile - Android",
      member: "Franz",
      event: "Sent item 000000 to trash",
    },
  ];

  dummyEventsSorted: {
    timeStamp: string;
    deviceType: string;
    member: string;
    event: string;
  }[];

  private orgUsersUserIdMap = new Map<string, any>();
  private destroy$ = new Subject<void>();
  readonly dummyEventsDisclaimer =
    "These events are examples only and do not reflect real events within your Bitwarden organization.";

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    eventService: EventService,
    i18nService: I18nService,
    exportService: EventExportService,
    platformUtilsService: PlatformUtilsService,
    private router: Router,
    logService: LogService,
    private userNamePipe: UserNamePipe,
    private organizationService: OrganizationService,
    private organizationUserApiService: OrganizationUserApiService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private providerService: ProviderService,
    fileDownloadService: FileDownloadService,
    toastService: ToastService,
    private accountService: AccountService,
    private dialogService: DialogService,
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
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.route.params
      .pipe(
        concatMap(async (params) => {
          this.organizationId = params.organizationId;
          this.organization = await firstValueFrom(
            this.organizationService
              .organizations$(userId)
              .pipe(getOrganizationById(this.organizationId)),
          );

          if (
            !this.organization ||
            (!this.organization.useEvents && !this.organization.isFreeOrFamilyOrg)
          ) {
            //update true to isFamily
            await this.router.navigate(["/organizations", this.organizationId]);
            return;
          }

          if (this.organization.isOwner && this.organization.isFreeOrFamilyOrg) {
            this.eventsForm.get("start").disable();
            this.eventsForm.get("end").disable();

            this.sortDummyEvents();

            this.userOrg = await firstValueFrom(
              this.organizationService
                .organizations$(userId)
                .pipe(getOrganizationById(this.organizationId)),
            );
            this.sub = await this.organizationApiService.getSubscription(this.organizationId);
          }

          await this.load();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  async load() {
    const response = await this.organizationUserApiService.getAllMiniUserDetails(
      this.organizationId,
    );
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
            this.organization.providerId,
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

    await this.refreshEvents();
    this.loaded = true;
  }

  protected requestEvents(startDate: string, endDate: string, continuationToken: string) {
    return this.apiService.getEventsOrganization(
      this.organizationId,
      startDate,
      endDate,
      continuationToken,
    );
  }

  protected getUserName(r: EventResponse, userId: string) {
    if (r.installationId != null) {
      return {
        name: `Installation: ${r.installationId}`,
      };
    }

    if (userId != null) {
      if (this.orgUsersUserIdMap.has(userId)) {
        return this.orgUsersUserIdMap.get(userId);
      }

      if (r.providerId != null && r.providerId === this.organization.providerId) {
        return {
          name: this.organization.providerName,
        };
      }
    }

    if (r.systemUser != null) {
      const systemUserI18nKey: string = EVENT_SYSTEM_USER_TO_TRANSLATION[r.systemUser];

      if (systemUserI18nKey) {
        return {
          name: this.i18nService.t(systemUserI18nKey),
        };
      } else {
        return {
          name: EventSystemUser[r.systemUser],
        };
      }
    }

    if (r.serviceAccountId) {
      return {
        name: this.i18nService.t("machineAccount") + " " + this.getShortId(r.serviceAccountId),
      };
    }

    return null;
  }

  private getShortId(id: string) {
    return id?.substring(0, 8);
  }

  async changePlan() {
    const reference = openChangePlanDialog(this.dialogService, {
      data: {
        organizationId: this.organizationId,
        subscription: this.sub,
        productTierType: this.userOrg.productTierType,
      },
    });

    const result = await lastValueFrom(reference.closed);

    if (result === ChangePlanDialogResultType.Closed) {
      return;
    }
    await this.load();
  }

  getRandomDateTime() {
    const now = new Date();
    const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const randomTime =
      past24Hours.getTime() + Math.random() * (now.getTime() - past24Hours.getTime());
    const randomDate = new Date(randomTime);

    return randomDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  sortDummyEvents() {
    this.dummyEventsSorted = this.dummyEvents.sort(
      (a, b) => new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime(),
    );
  }

  getOrganizationPlan() {
    const tierValue = this.organization.productTierType;
    const tierName = ProductTierType[tierValue];
    return tierName;
  }

  formatEventText(event: string): string {
    return event.replace(/000000/g, '<span class="tw-text-code">000000</span>');
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
