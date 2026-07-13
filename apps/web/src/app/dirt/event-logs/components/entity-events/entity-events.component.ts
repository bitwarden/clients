// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventResponse, EventView } from "@bitwarden/common/dirt/event-logs";
import { EventLogApiService } from "@bitwarden/common/dirt/event-logs/services/event-log-api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogService,
  TableDataSource,
  ToastService,
} from "@bitwarden/components";

import { SharedModule } from "../../../../shared";
import {
  EventOptions,
  EventService,
  MEMBER_EVENTS_HREF_PREFIX,
  SEND_EVENTS_HREF_PREFIX,
} from "../../services/event.service";
import {
  collectLinkableMemberIds,
  ResolvedMember,
  resolveSendAccessMember,
} from "../send-access-member";

export interface EntityEventsDialogParams {
  entity: "user" | "cipher" | "secret" | "project" | "service-account" | "send";
  entityId: string;

  organizationId?: string;
  providerId?: string;
  showUser?: boolean;
  name?: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [SharedModule],
  templateUrl: "entity-events.component.html",
})
export class EntityEventsComponent implements OnInit, OnDestroy {
  loading = true;
  continuationToken: string;
  protected dataSource = new TableDataSource<EventView>();
  protected filterFormGroup = this.formBuilder.group({
    start: [""],
    end: [""],
  });

  private orgUsersUserIdMap = new Map<string, ResolvedMember>();
  private orgUsersIdMap = new Map<string, any>();

  // These are editable fields (not read-only getters) on purpose: clicking a Send or member ID in
  // an event row reloads the dialog to show that item's events, instead of opening a new dialog.
  protected entity: EntityEventsDialogParams["entity"];
  protected entityId: string;
  protected name: string;
  private providerId?: string;

  get showUser() {
    return this.params.showUser ?? false;
  }

  constructor(
    @Inject(DIALOG_DATA) private params: EntityEventsDialogParams,
    private apiService: ApiService,
    private eventLogApiService: EventLogApiService,
    private i18nService: I18nService,
    private eventService: EventService,
    private userNamePipe: UserNamePipe,
    private logService: LogService,
    private organizationUserApiService: OrganizationUserApiService,
    private formBuilder: FormBuilder,
    private validationService: ValidationService,
    private toastService: ToastService,
    private router: Router,
    private activeRoute: ActivatedRoute,
    private accountService: AccountService,
    protected organizationService: OrganizationService,
  ) {}

  async ngOnInit() {
    this.entity = this.params.entity;
    this.entityId = this.params.entityId;
    this.name = this.params.name;
    this.providerId = this.params.providerId;

    const defaultDates = this.eventService.getDefaultDateFilters();
    this.filterFormGroup.setValue({
      start: defaultDates[0],
      end: defaultDates[1],
    });
    await this.load();
  }

  /**
   * Re-parameterizes the dialog in place to show a different entity's events (no stacked dialogs).
   */
  private async switchEntity(
    entity: EntityEventsDialogParams["entity"],
    entityId: string,
    name: string,
  ) {
    this.entity = entity;
    this.entityId = entityId;
    this.name = name;
    // this ensures a member click resolves via the organization-user endpoint, not the provider-user one
    this.providerId = undefined;
    this.continuationToken = null;
    this.dataSource.data = [];
    this.loading = true;
    await this.load();
  }

  protected onEventMessageClick(event: Event) {
    const href = (event.target as HTMLElement)?.closest("a")?.getAttribute("href");
    if (href == null) {
      return;
    }
    if (href.startsWith(SEND_EVENTS_HREF_PREFIX)) {
      event.preventDefault();
      const sendId = href.slice(SEND_EVENTS_HREF_PREFIX.length);
      void this.switchEntity(
        "send",
        sendId,
        this.i18nService.t("send") + " " + sendId.substring(0, 8),
      );
      return;
    }
    if (href.startsWith(MEMBER_EVENTS_HREF_PREFIX)) {
      event.preventDefault();
      const platformUserId = href.slice(MEMBER_EVENTS_HREF_PREFIX.length);
      const member = this.orgUsersUserIdMap.get(platformUserId);
      if (member?.organizationUserId != null) {
        void this.switchEntity("user", member.organizationUserId, member.name);
        if (this.params.organizationId != null) {
          void this.router.navigate(["/organizations", this.params.organizationId, "members"]);
        }
      }
    }
  }

  async ngOnDestroy() {
    await firstValueFrom(
      this.activeRoute.queryParams.pipe(
        switchMap(async (params) => {
          await this.router.navigate([], {
            queryParams: {
              ...params,
              viewEvents: null,
            },
          });
        }),
      ),
    );
  }

  async load() {
    try {
      if (this.showUser) {
        const response = await this.organizationUserApiService.getAllMiniUserDetails(
          this.params.organizationId,
        );
        response.data.forEach((u) => {
          const name = this.userNamePipe.transform(u);
          this.orgUsersIdMap.set(u.id, { name: name, email: u.email });
          this.orgUsersUserIdMap.set(u.userId, {
            name: name,
            email: u.email,
            organizationUserId: u.id,
          });
        });
      }
      await this.loadEvents(true);
    } catch (e) {
      this.logService.error(e);
      this.validationService.showError(e);
    }

    this.loading = false;
  }

  loadMoreEvents = async () => {
    await this.loadEvents(false);
  };

  refreshEvents = async () => {
    await this.loadEvents(true);
  };

  private async loadEvents(clearExisting: boolean) {
    let dates: string[] = null;
    try {
      dates = this.eventService.formatDateFilters(
        this.filterFormGroup.value.start,
        this.filterFormGroup.value.end,
      );
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidDateRange"),
      });
      return;
    }

    const token = clearExisting ? null : this.continuationToken;
    const orgId = this.params.organizationId;

    let response: ListResponse<EventResponse>;
    switch (this.entity) {
      case "user":
        response = this.providerId
          ? await this.apiService.getEventsProviderUser(
              this.providerId,
              this.entityId,
              dates[0],
              dates[1],
              token,
            )
          : await this.apiService.getEventsOrganizationUser(
              orgId,
              this.entityId,
              dates[0],
              dates[1],
              token,
            );
        break;
      case "send":
        response = await this.eventLogApiService.getEventsSend(
          orgId,
          this.entityId,
          dates[0],
          dates[1],
          token,
        );
        break;
      case "secret":
        response = await this.apiService.getEventsSecret(
          orgId,
          this.entityId,
          dates[0],
          dates[1],
          token,
        );
        break;
      case "service-account":
        response = await this.apiService.getEventsServiceAccount(
          orgId,
          this.entityId,
          dates[0],
          dates[1],
          token,
        );
        break;
      case "project":
        response = await this.apiService.getEventsProject(
          orgId,
          this.entityId,
          dates[0],
          dates[1],
          token,
        );
        break;
      case "cipher":
      default:
        response = await this.apiService.getEventsCipher(this.entityId, dates[0], dates[1], token);
        break;
    }

    const options = new EventOptions();
    options.hideSendId = this.entity === "send";
    // Built from the org user map, which is only populated when showUser is set. Dialogs that don't
    // load member data (showUser=false) get an empty set, so creator ids render as plain text rather
    // than links that would resolve to nothing on click.
    options.linkableMemberIds = collectLinkableMemberIds(this.orgUsersUserIdMap);

    this.continuationToken = response.continuationToken;
    const events: EventView[] = await Promise.all(
      response.data.map(async (r) => {
        const userId = r.actingUserId == null ? r.userId : r.actingUserId;
        const eventInfo = await this.eventService.getEventInfo(r, options);
        const user = this.showUser ? this.resolveMember(r, userId) : null;

        return new EventView({
          message: eventInfo.message,
          humanReadableMessage: eventInfo.humanReadableMessage,
          appIcon: eventInfo.appIcon,
          appName: eventInfo.appName,
          userId: userId,
          actingUserId: r.actingUserId,
          userName: user != null ? user.name : this.showUser ? this.i18nService.t("unknown") : null,
          userEmail: user != null ? user.email : this.showUser ? "" : null,
          date: r.date,
          ip: r.ipAddress,
          type: r.type,
          installationId: r.installationId,
          systemUser: r.systemUser,
          serviceAccountId: r.serviceAccountId,
        });
      }),
    );

    if (!clearExisting && this.dataSource.data != null && this.dataSource.data.length > 0) {
      this.dataSource.data = this.dataSource.data.concat(events);
    } else {
      this.dataSource.data = events;
    }
  }

  // Send access rows show the accessor (a confirmed member, the claimed domain, or "External"),
  // never the Send creator; all other rows resolve the acting member from the org user map.
  private resolveMember(r: EventResponse, userId: string) {
    const sendAccessMember = resolveSendAccessMember(r, this.orgUsersUserIdMap, this.i18nService);
    if (sendAccessMember != null) {
      return sendAccessMember;
    }

    if (userId != null && this.orgUsersUserIdMap.has(userId)) {
      return this.orgUsersUserIdMap.get(userId);
    }

    return null;
  }
}

/**
 * Strongly typed helper to open a EntityEventsComponent as a dialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export const openEntityEventsDialog = (
  dialogService: DialogService,
  config: DialogConfig<EntityEventsDialogParams>,
) => {
  return dialogService.open<void, EntityEventsDialogParams>(EntityEventsComponent, config);
};
