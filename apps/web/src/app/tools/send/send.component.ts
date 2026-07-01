// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, HostListener, viewChildren } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { lastValueFrom, switchMap, combineLatest, map, firstValueFrom } from "rxjs";

import { NoSendsIcon } from "@bitwarden/assets/svg";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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
    CalloutComponent,
    CommonModule,
    AsyncActionsModule,
    FormsModule,
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
   * Flipped to true once a lock or logout message is observed. While set, the
   * `beforeunload` handler stands down so that `window.location.reload()` from
   * `processReloadService` can complete without the browser surfacing its
   * native "Reload site?" prompt. Lock/logout always wins over unsaved edits.
   */
  private lockOrLogoutInFlight = false;

  /**
   * Prevent browser tab from closing/refreshing if the Send form has unsaved edits.
   * Shows a confirmation dialog if user tries to leave.
   * This provides additional protection beyond dialogRef.disableClose.
   * Using arrow function to preserve 'this' context when used as event listener.
   */
  @HostListener("window:beforeunload", ["$event"])
  private handleBeforeUnloadEvent = (event: BeforeUnloadEvent): string | undefined => {
    if (this.lockOrLogoutInFlight) {
      return undefined;
    }
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
    private sendFormConfigService: DefaultSendFormConfigService,
    private accountService: AccountService,
    private route: ActivatedRoute,
    private router: Router,
    private configService: ConfigService,
    private sendFormService: SendFormService,
    private sendItemsService: SendItemsService,
    private sendItemsFiltersService: SendListFiltersService,
    private validationService: ValidationService,
    authService: AuthService,
  ) {
    // Lock/logout always wins over the unsaved-edits guard. We listen for the
    // active account's auth status leaving `Unlocked` — `lockService.lock`
    // flips this during `wipeDecryptedState` / `waitForLockedStatus`, well
    // before it sends the `"locked"` message or starts the process reload.
    // Listening here (rather than on the `"locked"` message) avoids a race
    // where Chrome fires `beforeunload` synchronously inside
    // `window.location.reload()`, before our message subscriber gets its turn
    // in the Subject emission order. Same applies for logout.
    authService.activeAccountStatus$.pipe(takeUntilDestroyed()).subscribe((status) => {
      if (status !== AuthenticationStatus.Unlocked) {
        this.lockOrLogoutInFlight = true;
      }
    });

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
  }

  async addSend() {
    if (this.disableSend()) {
      return;
    }

    const config = await this.sendFormConfigService.buildConfig("add", null, SendType.Text);

    await this.openSendItemDialog(config);
  }

  async editSend(send: SendView) {
    const config = await this.sendFormConfigService.buildConfig(
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
    const sendItemDialogRef = await SendAddEditDialogComponent.openDrawer(this.dialogService, {
      formConfig,
      closePredicate: this.sendFormService.promptForUnsavedEdits.bind(this.sendFormService),
    });

    // If we were unable to open the dialog (because the previous drawer failed to close, for example) exit immediately
    if (!sendItemDialogRef) {
      return;
    } else {
      this.sendItemDialogRef = sendItemDialogRef;
    }

    const result = await lastValueFrom(this.sendItemDialogRef.closed);
    this.sendItemDialogRef = undefined;

    // If we created a new Send, open the success drawer
    if (result?.result === SendItemDialogResult.Created && result?.send) {
      await this.dialogService.openDrawer(SendSuccessDrawerDialogComponent, {
        data: result.send,
      });
    }

    // If we updated a Send, open the drawer back up with the updated Send now set as the original
    if (result?.result === SendItemDialogResult.Updated && result?.send) {
      const newConfig = await this.sendFormConfigService.buildConfig(
        formConfig.mode,
        result.send.id as SendId,
        result.send.type,
      );
      await this.openSendItemDialog(newConfig);
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
