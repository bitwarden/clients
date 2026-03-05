// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, switchMap, combineLatest, map } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendFilterType } from "@bitwarden/common/tools/send/types/send-filter-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { DialogService, ToastService } from "@bitwarden/components";
import { SendItemsService, SendListState, SendListFiltersService } from "@bitwarden/send-ui";

@Directive()
export class SendComponent {
  sendType = SendType;

  actionPromise: any;

  protected sendItemsService = inject(SendItemsService);
  protected sendListFiltersService = inject(SendListFiltersService);
  protected dialogService = inject(DialogService);
  protected i18nService = inject(I18nService);
  protected sendApiService = inject(SendApiService);
  protected toastService = inject(ToastService);
  protected logService = inject(LogService);
  protected platformUtilsService = inject(PlatformUtilsService);
  protected environmentService = inject(EnvironmentService);

  private accountService = inject(AccountService);
  private policyService = inject(PolicyService);

  protected readonly filteredSends = toSignal(this.sendItemsService.filteredAndSortedSends$, {
    initialValue: [],
  });

  protected readonly loading = toSignal(this.sendItemsService.loading$, { initialValue: true });

  protected readonly disableSend = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policyAppliesToUser$(PolicyType.DisableSend, userId),
      ),
    ),
    { initialValue: false },
  );

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

  protected readonly currentSearchFilter = toSignal(
    this.sendListFiltersService.filters$.pipe(
      map((value): SendFilterType => this.sendTypeToSendFilterType(value.sendType)),
    ),
    { initialValue: SendFilterType.All },
  );

  protected sendFilterTypeToSendType(filterType: SendFilterType): SendType | null {
    switch (filterType) {
      case SendFilterType.Text:
        return SendType.Text;
      case SendFilterType.File:
        return SendType.File;
      default: // SendFilterType.All
        return null;
    }
  }

  protected sendTypeToSendFilterType(sendType: SendType | null): SendFilterType {
    switch (sendType) {
      case SendType.Text:
        return SendFilterType.Text;
      case SendType.File:
        return SendFilterType.File;
      default:
        return SendFilterType.All;
    }
  }

  async removePassword(s: SendView): Promise<boolean> {
    if (this.actionPromise != null || s.password == null) {
      return false;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removePassword" },
      content: { key: "removePasswordConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      this.actionPromise = this.sendApiService.removePassword(s.id);
      await this.actionPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("removedPassword"),
      });
    } catch (e) {
      this.logService.error(e);
    }
    this.actionPromise = null;
    return true;
  }

  async delete(s: SendView): Promise<boolean> {
    if (this.actionPromise != null) {
      return false;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      this.actionPromise = this.sendApiService.delete(s.id);
      await this.actionPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedSend"),
      });
    } catch (e) {
      this.logService.error(e);
    }
    this.actionPromise = null;
    return true;
  }

  async copy(s: SendView) {
    const env = await firstValueFrom(this.environmentService.environment$);
    const link = env.getSendUrl() + s.accessId + "/" + s.urlB64Key;
    this.platformUtilsService.copyToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
    });
  }
}
