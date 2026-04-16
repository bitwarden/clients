// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, lastValueFrom, map } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { SendId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ButtonModule, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import {
  NewSendDropdownV2Component,
  SendItemsService,
  SendListComponent,
  SendListState,
  SendAddEditDialogComponent,
  DefaultSendFormConfigService,
  SendItemDialogResult,
  SendPolicyService,
} from "@bitwarden/send-ui";

import { DesktopPremiumUpgradePromptService } from "../../../services/desktop-premium-upgrade-prompt.service";
import { DesktopHeaderComponent } from "../../layout/header";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send",
  imports: [ButtonModule, SendListComponent, NewSendDropdownV2Component, DesktopHeaderComponent],
  providers: [
    DefaultSendFormConfigService,
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
  ],
  templateUrl: "./send.component.html",
})
export class SendComponent {
  private sendFormConfigService = inject(DefaultSendFormConfigService);
  private sendItemsService = inject(SendItemsService);
  private sendPolicyService = inject(SendPolicyService);
  private i18nService = inject(I18nService);
  private platformUtilsService = inject(PlatformUtilsService);
  private environmentService = inject(EnvironmentService);
  private sendApiService = inject(SendApiService);
  private dialogService = inject(DialogService);
  private toastService = inject(ToastService);
  private logService = inject(LogService);
  private destroyRef = inject(DestroyRef);

  private activeDrawerRef?: DialogRef<SendItemDialogResult>;

  protected readonly filteredSends = toSignal(this.sendItemsService.filteredAndSortedSends$, {
    initialValue: [],
  });

  protected readonly loading = toSignal(this.sendItemsService.loading$, { initialValue: true });

  protected readonly currentSearchText = toSignal(this.sendItemsService.latestSearchText$, {
    initialValue: "",
  });

  protected readonly disableSend = toSignal(this.sendPolicyService.disableSend$, {
    initialValue: false,
  });

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

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.activeDrawerRef?.close();
    });
  }

  protected async addSend(type: SendType): Promise<void> {
    const formConfig = await this.sendFormConfigService.buildConfig("add", undefined, type);

    this.activeDrawerRef = SendAddEditDialogComponent.openDrawer(this.dialogService, {
      formConfig,
    });

    await lastValueFrom(this.activeDrawerRef.closed);
    this.activeDrawerRef = null;
  }

  protected async selectSend(sendId: string): Promise<void> {
    const formConfig = await this.sendFormConfigService.buildConfig("edit", sendId as SendId);

    this.activeDrawerRef = SendAddEditDialogComponent.openDrawer(this.dialogService, {
      formConfig,
    });

    await lastValueFrom(this.activeDrawerRef.closed);
    this.activeDrawerRef = null;
  }

  protected async onEditSend(send: SendView): Promise<void> {
    await this.selectSend(send.id);
  }

  protected async onCopySend(send: SendView): Promise<void> {
    const env = await this.environmentService.getEnvironment();
    const link = env.getSendUrl() + send.accessId + "/" + send.urlB64Key;
    this.platformUtilsService.copyToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
    });
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
      this.logService.error(e);
    }
  }

  protected async onDeleteSend(send: SendView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    await this.sendApiService.delete(send.id);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("deletedSend"),
    });
  }
}
