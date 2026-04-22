// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AsyncPipe, CommonModule } from "@angular/common";
import { Component, OnDestroy, HostListener, viewChildren } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { lastValueFrom, Observable, switchMap, combineLatest, map, firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoSendsIcon } from "@bitwarden/assets/svg";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendFilterType } from "@bitwarden/common/tools/send/types/send-filter-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { SendId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  CalloutComponent,
  DialogRef,
  DialogService,
  NoItemsModule,
  SearchModule,
  ToastService,
  ToggleGroupModule,
  IconComponent,
} from "@bitwarden/components";
import {
  DefaultSendFormConfigService,
  SendFormConfig,
  SendAddEditDialogComponent,
  SendItemDialogResult,
  SendFormService,
  SendFormModule,
  SendItemsService,
  SendListComponent,
  SendListState,
  SendListFiltersService,
} from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";

import { NewSendDropdownComponent } from "./new-send/new-send-dropdown.component";
import { SendSuccessDrawerDialogComponent } from "./shared";

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
    SendFormModule,
    SendListComponent,
  ],
  templateUrl: "send.component.html",
  providers: [DefaultSendFormConfigService],
})
export class SendComponent implements OnDestroy {
  /**
   * Prevent browser tab from closing/refreshing if the Send form has unsaved edits.
   * Shows a confirmation dialog if user tries to leave.
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

  protected readonly filteredSends = toSignal(this.sendItemsService.filteredAndSortedSends$, {
    initialValue: [],
  });

  protected readonly disableSend = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policyAppliesToUser$(PolicyType.DisableSend, userId),
      ),
    ),
    { initialValue: false },
  );

  protected readonly loading = toSignal(this.sendItemsService.loading$, { initialValue: true });

  protected readonly listState = toSignal(
    combineLatest([
      this.sendItemsService.emptyList$,
      this.sendItemsService.noFilteredResults$,
    ]).pipe(
      map(([emptyList, noFilteredResults]): SendListState | null => {
        if (emptyList) {
          return SendListState.Empty;
        }
        if (noFilteredResults) {
          return SendListState.NoResults;
        }
        return null;
      }),
    ),
    { initialValue: null },
  );

  protected readonly currentSearchText = toSignal(this.sendItemsService.latestSearchText$, {
    initialValue: "",
  });

  // Legacy variables. TODO: Remove once the SendUI refresh is permanently enabled
  SendFilterType = SendFilterType;
  SendType = SendType;

  private readonly newSendDropdowns = viewChildren(NewSendDropdownComponent);

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private policyService: PolicyService,
    private logService: LogService,
    private sendApiService: SendApiService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private addEditFormConfigService: DefaultSendFormConfigService,
    private accountService: AccountService,
    private route: ActivatedRoute,
    private router: Router,
    private configService: ConfigService,
    private sendFormService: SendFormService,
    private sendItemsService: SendItemsService,
    private sendItemsFiltersService: SendListFiltersService,
    private validationService: ValidationService,
  ) {
    this.SendUIRefresh$ = this.configService.getFeatureFlag$(FeatureFlag.SendUIRefresh);

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const typeParam = params.get("type");
      let toggleValue: SendFilterType = SendFilterType.All;
      let sendType: SendType | null = null;
      if (typeParam === SendFilterType.Text) {
        toggleValue = SendFilterType.Text;
        sendType = SendType.Text;
      }
      if (typeParam === SendFilterType.File) {
        toggleValue = SendFilterType.File;
        sendType = SendType.File;
      }
      this.selectedToggleValue = toggleValue;
      this.sendItemsFiltersService.filterForm.patchValue({ sendType });
    });
  }

  ngOnDestroy() {
    this.dialogService.closeAll();
    void this.dialogService.closeDrawer();
  }

  async addSend() {
    if (this.disableSend()) {
      return;
    }

    const config = await this.addEditFormConfigService.buildConfig("add", null, SendType.Text);

    await this.openSendItemDialog(config);
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

    let sendItemDialogRef: DialogRef<SendItemDialogResult, SendAddEditDialogComponent> | undefined;
    if (useRefresh) {
      sendItemDialogRef = await SendAddEditDialogComponent.openDrawer(this.dialogService, {
        formConfig,
        closePredicate: this.sendFormService.promptForUnsavedEdits.bind(this.sendFormService),
      });
    } else {
      sendItemDialogRef = SendAddEditDialogComponent.open(this.dialogService, {
        formConfig,
        closePredicate: this.sendFormService.promptForUnsavedEdits.bind(this.sendFormService),
      });
    }

    // If we were unable to open the dialog (because the previous drawer failed to close, for example) exit immediately
    if (!sendItemDialogRef) {
      return;
    } else {
      this.sendItemDialogRef = sendItemDialogRef;
    }

    const result = await lastValueFrom(this.sendItemDialogRef.closed);
    this.sendItemDialogRef = undefined;

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
    if (this.sendItemDialogRef) {
      const closeResult = await this.sendItemDialogRef.close();
      return closeResult.closed;
    }
    // This check is necessary to prevent navigation away from the Send page when the
    // Send edit drawer was opened by either the header button or the button that shows
    // in the Send table when there are no existing Sends.
    for (const newSendDropdown of this.newSendDropdowns()) {
      const closed = await newSendDropdown.saveUnsavedSendEdits();
      if (!closed) {
        return false;
      }
    }
    return true;
  }

  async deleteSend(s: SendView): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      await this.sendApiService.delete(s.id);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedSend"),
      });
    } catch (e) {
      this.validationService.showError(e);
      this.logService.error(e);
      return false;
    }
    return true;
  }

  protected async onRemovePassword(send: SendView): Promise<void> {
    if (this.disableSend()) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removePassword" },
      content: { key: "removePasswordConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.sendApiService.removePassword(send.id);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("removedPassword"),
      });
    } catch (e) {
      this.validationService.showError(e);
      this.logService.error(e);
    }
  }

  protected async onCopySend(send: SendView): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
    const env = await firstValueFrom(this.environmentService.getEnvironment$(userId));
    const link = env.getSendUrl() + send.accessId + "/" + send.urlB64Key;
    this.platformUtilsService.copyToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
    });
  }

  // Legacy method. TODO: Remove once the SendUI refresh is permanently enabled
  searchTextChanged(newSearchText: string) {
    this.sendItemsService.applyFilter(newSearchText);
  }
}
