// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { concatMap, firstValueFrom, lastValueFrom, map, of, switchMap, takeUntil, tap } from "rxjs";

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
import {
  EventSystemUser,
  EventResponse,
  EventType,
  EventView,
} from "@bitwarden/common/dirt/event-logs";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  ChangePlanDialogResultType,
  openChangePlanDialog,
} from "../../../../billing/organizations/change-plan-dialog.component";
import { HeaderModule } from "../../../../layouts/header/header.module";
import { SharedModule } from "../../../../shared";
import { EventExportService } from "../../../../tools/event-export";
import {
  EventService,
  MEMBER_EVENTS_HREF_PREFIX,
  SEND_EVENTS_HREF_PREFIX,
} from "../../services/event.service";
import { BaseEventsComponent } from "../base-events/base-events.component";
import { openEntityEventsDialog } from "../entity-events/entity-events.component";
import { placeholderEvents } from "../placeholder-events";
import {
  collectLinkableMemberIds,
  isLinkableMember,
  ResolvedMember,
  resolveSendAccessMember,
} from "../send-access-member";

const EVENT_SYSTEM_USER_TO_TRANSLATION: Record<EventSystemUser, string> = {
  [EventSystemUser.SCIM]: null, // SCIM acronym not able to be translated so just display SCIM
  [EventSystemUser.DomainVerification]: "domainVerification",
  [EventSystemUser.PublicApi]: "publicApi",
  [EventSystemUser.BitwardenPortal]: "system",
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "events.component.html",
  imports: [SharedModule, HeaderModule],
})
export class EventsComponent extends BaseEventsComponent implements OnInit, OnDestroy {
  exportFileName = "org-events";
  organizationId: string;
  organization: Organization;
  organizationSubscription: OrganizationSubscriptionResponse;

  placeholderEvents = placeholderEvents as EventView[];

  private orgUsersUserIdMap = new Map<string, ResolvedMember>();
  readonly ProductTierType = ProductTierType;

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    eventService: EventService,
    i18nService: I18nService,
    exportService: EventExportService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    private userNamePipe: UserNamePipe,
    protected organizationService: OrganizationService,
    private organizationUserApiService: OrganizationUserApiService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private providerService: ProviderService,
    fileDownloadService: FileDownloadService,
    toastService: ToastService,
    protected accountService: AccountService,
    private dialogService: DialogService,
    private configService: ConfigService,
    protected activeRoute: ActivatedRoute,
    private router: Router,
  ) {
    super(
      eventService,
      i18nService,
      exportService,
      platformUtilsService,
      logService,
      fileDownloadService,
      toastService,
      activeRoute,
      accountService,
      organizationService,
    );
  }

  async ngOnInit() {
    this.initBase();

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

          if (!this.organization.useEvents) {
            this.eventsForm.get("start").disable();
            this.eventsForm.get("end").disable();

            this.organizationSubscription = await this.organizationApiService.getSubscription(
              this.organizationId,
            );
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
      // Store the organization user id too, so event-log links keyed on a platform user id can
      // navigate to (and open the events dialog for) the corresponding member.
      this.orgUsersUserIdMap.set(u.userId, {
        name: name,
        email: u.email,
        organizationUserId: u.id,
      });
    });

    if (this.organization.providerId != null) {
      try {
        await firstValueFrom(
          this.accountService.activeAccount$.pipe(
            getUserId,
            switchMap((userId) => this.providerService.get$(this.organization.providerId, userId)),
            map((provider) => provider != null && provider.canManageUsers),
            switchMap((canManage) => {
              if (canManage) {
                return this.apiService.getProviderUsers(this.organization.providerId);
              }
              return of(null);
            }),
            tap((providerUsersResponse) => {
              if (providerUsersResponse) {
                providerUsersResponse.data.forEach((u) => {
                  const name = this.userNamePipe.transform(u);
                  this.orgUsersUserIdMap.set(u.userId, {
                    name: `${name} (${this.organization.providerName})`,
                    email: u.email,
                  });
                });
              }
            }),
          ),
        );
      } catch (e) {
        this.logService.warning(e);
      }
    }
    await this.refreshEvents();
    this.loaded.set(true);
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
    // Send access rows show the accessor, never the Send creator. This must run before the userId
    // lookup below: EventView.userId coalesces to the creator for external accesses, which would
    // otherwise show the creator's name instead of "External".
    const sendAccessMember = resolveSendAccessMember(r, this.orgUsersUserIdMap, this.i18nService);
    if (sendAccessMember != null) {
      return sendAccessMember;
    }

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

  protected override linkableMemberIds(): ReadonlySet<string> {
    return collectLinkableMemberIds(this.orgUsersUserIdMap);
  }

  /** True when the Member-column name on a Send access row resolves to a member we can link to. */
  protected isSendAccessMemberLink(e: EventView): boolean {
    // Link only when the ACCESSOR is a confirmed member. Use actingUserId, not e.userId: the latter
    // coalesces to the Send creator for external accesses, which would wrongly link the "External" label.
    return (
      (e.type === EventType.Send_Accessed_Text || e.type === EventType.Send_Accessed_File) &&
      isLinkableMember(e.actingUserId, this.orgUsersUserIdMap)
    );
  }

  /** Delegated handler for the interactive id links in an event message (Send id, creator user id). */
  protected onEventMessageClick(event: Event) {
    const href = (event.target as HTMLElement)?.closest("a")?.getAttribute("href");
    if (href == null) {
      return;
    }
    if (href.startsWith(SEND_EVENTS_HREF_PREFIX)) {
      event.preventDefault();
      this.openSendEventsDialog(href.slice(SEND_EVENTS_HREF_PREFIX.length));
      return;
    }
    if (href.startsWith(MEMBER_EVENTS_HREF_PREFIX)) {
      event.preventDefault();
      this.openMemberEventsDialog(href.slice(MEMBER_EVENTS_HREF_PREFIX.length));
    }
  }

  /** Member-column name click on a Send access row. */
  protected memberNameClicked(event: Event, platformUserId: string) {
    event.preventDefault();
    this.openMemberEventsDialog(platformUserId);
  }

  private openSendEventsDialog(sendId: string) {
    if (sendId == null) {
      return;
    }
    openEntityEventsDialog(this.dialogService, {
      data: {
        entity: "send",
        entityId: sendId,
        organizationId: this.organizationId,
        name: this.i18nService.t("send") + " " + this.getShortId(sendId),
        showUser: true,
      },
    });
  }

  private openMemberEventsDialog(platformUserId: string) {
    const member = platformUserId != null ? this.orgUsersUserIdMap.get(platformUserId) : null;
    if (member?.organizationUserId == null) {
      return;
    }
    openEntityEventsDialog(this.dialogService, {
      data: {
        entity: "user",
        entityId: member.organizationUserId,
        organizationId: this.organizationId,
        name: member.name,
        showUser: true,
      },
    });
    void this.router.navigate(["/organizations", this.organizationId, "members"]);
  }

  private getShortId(id: string) {
    return id?.substring(0, 8);
  }

  async changePlan() {
    const reference = openChangePlanDialog(this.dialogService, {
      data: {
        organizationId: this.organizationId,
        subscription: this.organizationSubscription,
        productTierType: this.organization.productTierType,
      },
    });

    const result = await lastValueFrom(reference.closed);

    if (result === ChangePlanDialogResultType.Closed) {
      return;
    }
    await this.load();
  }
}
