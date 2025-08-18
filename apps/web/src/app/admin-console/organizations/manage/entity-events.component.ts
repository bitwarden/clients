// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventResponse } from "@bitwarden/common/models/response/event.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { EventView } from "@bitwarden/common/models/view/event.view";
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

import { EventService } from "../../../core";
import { SharedModule } from "../../../shared";

export interface EntityEventsDialogParams {
  entity: "user" | "cipher";
  entityId: string;

  organizationId?: string;
  providerId?: string;
  showUser?: boolean;
  name?: string;
}

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

  private orgUsersUserIdMap = new Map<string, any>();
  private orgUsersIdMap = new Map<string, any>();

  get name() {
    return this.params.name;
  }

  get showUser() {
    return this.params.showUser ?? false;
  }

  constructor(
    @Inject(DIALOG_DATA) private params: EntityEventsDialogParams,
    private apiService: ApiService,
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
  ) {}

  async ngOnInit() {
    const defaultDates = this.eventService.getDefaultDateFilters();
    this.filterFormGroup.setValue({
      start: defaultDates[0],
      end: defaultDates[1],
    });
    await this.load();
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
          this.orgUsersUserIdMap.set(u.userId, { name: name, email: u.email });
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

    let response: ListResponse<EventResponse>;
    if (this.params.entity === "user" && this.params.providerId) {
      response = await this.apiService.getEventsProviderUser(
        this.params.providerId,
        this.params.entityId,
        dates[0],
        dates[1],
        clearExisting ? null : this.continuationToken,
      );
    } else if (this.params.entity === "user") {
      response = await this.apiService.getEventsOrganizationUser(
        this.params.organizationId,
        this.params.entityId,
        dates[0],
        dates[1],
        clearExisting ? null : this.continuationToken,
      );
    } else {
      response = await this.apiService.getEventsCipher(
        this.params.entityId,
        dates[0],
        dates[1],
        clearExisting ? null : this.continuationToken,
      );
    }

    this.continuationToken = response.continuationToken;
    const events: EventView[] = await Promise.all(
      response.data.map(async (r) => {
        const userId = r.actingUserId == null ? r.userId : r.actingUserId;
        const eventInfo = await this.eventService.getEventInfo(r);
        const user =
          this.showUser && userId != null && this.orgUsersUserIdMap.has(userId)
            ? this.orgUsersUserIdMap.get(userId)
            : null;

        return new EventView({
          message: eventInfo.message,
          humanReadableMessage: eventInfo.humanReadableMessage,
          appIcon: eventInfo.appIcon,
          appName: eventInfo.appName,
          userId: userId,
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
