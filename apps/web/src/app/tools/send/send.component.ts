// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AsyncPipe, CommonModule } from "@angular/common";
import { Component, NgZone, OnInit, OnDestroy, HostListener } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { lastValueFrom, Observable, switchMap, EMPTY } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SendComponent as BaseSendComponent } from "@bitwarden/angular/tools/send/send.component";
import { NoSendsIcon } from "@bitwarden/assets/svg";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendFilterType } from "@bitwarden/common/tools/send/types/send-filter-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { SendId } from "@bitwarden/common/types/guid";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import {
  AsyncActionsModule,
  CalloutComponent,
  DialogRef,
  DialogService,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  ToastService,
  ToggleGroupModule,
  SpinnerComponent,
  IconComponent,
} from "@bitwarden/components";
import {
  DefaultSendFormConfigService,
  SendFormConfig,
  SendAddEditDialogComponent,
  SendItemDialogResult,
  SendTableComponent,
  SendFormService,
  SendFormModule,
} from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";

import { NewSendDropdownComponent } from "./new-send/new-send-dropdown.component";
import { SendSuccessDrawerDialogComponent } from "./shared";

const BroadcasterSubscriptionId = "SendComponent";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send",
  imports: [
    I18nPipe,
    AsyncPipe,
    CalloutComponent,
    CommonModule,
    AsyncActionsModule,
    FormsModule,
    JslibModule,
    IconComponent,
    SearchModule,
    NoItemsModule,
    HeaderModule,
    NewSendDropdownComponent,
    ToggleGroupModule,
    SendTableComponent,
    SendFormModule,
    SpinnerComponent,
  ],
  templateUrl: "send.component.html",
  providers: [DefaultSendFormConfigService],
})
export class SendComponent extends BaseSendComponent implements OnInit, OnDestroy {
  /**
   * Prevent browser tab from closing/refreshing if the Send form has unsaved edits.
   * Shows a confirmation dialog if user tries to leave during an active upload.
   * This provides additional protection beyond dialogRef.disableClose.
   * Using arrow function to preserve 'this' context when used as event listener.
   */
  @HostListener("window:beforeunload", ["$event"])
  private handleBeforeUnloadEvent = (event: BeforeUnloadEvent): string | undefined => {
    if (this.sendFormService.sendFormHasEdits()) {
      event.preventDefault();
      // The custom message is not displayed in modern browsers, but MDN docs still recommend setting it for legacy support.
      const message = this.i18nService.t("sendHasUnsavedEdits");
      event.returnValue = message;
      return message;
    }
    return undefined;
  };

  private sendItemDialogRef?:
    | DialogRef<SendItemDialogResult, SendAddEditDialogComponent>
    | undefined;
  noItemIcon = NoSendsIcon;
  selectedToggleValue?: SendFilterType;
  SendUIRefresh$: Observable<boolean>;

  override set filteredSends(filteredSends: SendView[]) {
    super.filteredSends = filteredSends;
    this.dataSource.data = filteredSends;
  }

  override get filteredSends() {
    return super.filteredSends;
  }

  protected dataSource = new TableDataSource<SendView>();

  constructor(
    sendService: SendService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
    ngZone: NgZone,
    searchService: SearchService,
    policyService: PolicyService,
    private broadcasterService: BroadcasterService,
    logService: LogService,
    sendApiService: SendApiService,
    dialogService: DialogService,
    toastService: ToastService,
    private addEditFormConfigService: DefaultSendFormConfigService,
    accountService: AccountService,
    private route: ActivatedRoute,
    private router: Router,
    private configService: ConfigService,
    private sendFormService: SendFormService,
  ) {
    super(
      sendService,
      i18nService,
      platformUtilsService,
      environmentService,
      ngZone,
      searchService,
      policyService,
      logService,
      sendApiService,
      dialogService,
      toastService,
      accountService,
    );

    this.SendUIRefresh$ = this.configService.getFeatureFlag$(FeatureFlag.SendUIRefresh);

    this.SendUIRefresh$.pipe(
      switchMap((sendUiRefreshEnabled) => {
        if (sendUiRefreshEnabled) {
          return this.route.queryParamMap;
        }
        return EMPTY;
      }),
      takeUntilDestroyed(),
    ).subscribe((params) => {
      const typeParam = params.get("type");
      const value = (
        typeParam === SendFilterType.Text || typeParam === SendFilterType.File
          ? typeParam
          : SendFilterType.All
      ) as SendFilterType;
      this.selectedToggleValue = value;

      if (this.loaded) {
        this.applyTypeFilter(value);
      }
    });
  }

  async ngOnInit() {
    await super.ngOnInit();
    this.onSuccessfulLoad = async () => {
      this.applyTypeFilter(this.selectedToggleValue);
    };

    await this.load();

    // Broadcaster subscription - load if sync completes in the background
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            if (message.successfully) {
              await this.load();
            }
            break;
        }
      });
    });
  }

  ngOnDestroy() {
    this.dialogService.closeAll();
    void this.dialogService.closeDrawer();
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  async editSend(send: SendView) {
    const config = await this.addEditFormConfigService.buildConfig(
      send == null ? "add" : "edit",
      send == null ? null : (send.id as SendId),
      send.type,
    );

    await this.openSendItemDialog(config);
  }

  /**
   * Opens the send item dialog.
   * @param formConfig The form configuration.
   * */
  async openSendItemDialog(formConfig: SendFormConfig) {
    const useRefresh = await this.configService.getFeatureFlag(FeatureFlag.SendUIRefresh);
    // Prevent multiple dialogs from being opened but allow drawers since they will prevent multiple being open themselves
    if (this.sendItemDialogRef && !useRefresh) {
      return;
    }

    if (useRefresh) {
      this.sendItemDialogRef = await SendAddEditDialogComponent.openDrawer(this.dialogService, {
        formConfig,
        closePredicate: this.sendFormService.saveSendEdits.bind(this.sendFormService),
      });
    } else {
      this.sendItemDialogRef = SendAddEditDialogComponent.open(this.dialogService, {
        formConfig,
        closePredicate: this.sendFormService.saveSendEdits.bind(this.sendFormService),
      });
    }

    // If we were unable to open the dialog (because the previous drawer failed to close, for example) exit immediately
    if (!this.sendItemDialogRef) {
      return;
    }

    const result = await lastValueFrom(this.sendItemDialogRef.closed);
    this.sendItemDialogRef = undefined;

    // If the dialog was closed by deleting or saving the Send, refresh the vault.
    if (
      result?.result === SendItemDialogResult.Deleted ||
      result?.result === SendItemDialogResult.Saved
    ) {
      await this.load();
    }

    if (
      result?.result === SendItemDialogResult.Saved &&
      result?.send &&
      (await this.configService.getFeatureFlag(FeatureFlag.SendUIRefresh))
    ) {
      await this.dialogService.openDrawer(SendSuccessDrawerDialogComponent, {
        data: result.send,
      });
    }
  }

  private applyTypeFilter(value: SendFilterType) {
    if (value === SendFilterType.All) {
      this.selectAll();
    } else if (value === SendFilterType.Text) {
      this.selectType(SendType.Text);
    } else if (value === SendFilterType.File) {
      this.selectType(SendType.File);
    }
  }

  onToggleChange(value: SendFilterType) {
    const queryParams = value === SendFilterType.All ? { type: null } : { type: value };

    this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams,
        queryParamsHandling: "merge",
      })
      .catch((err) => {
        this.logService.error("Failed to update route query params:", err);
      });
  }

  async saveUnsavedSendEdits() {
    return this.sendItemDialogRef?.close() ?? true;
  }
}
