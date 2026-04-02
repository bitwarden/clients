// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, map, switchMap, lastValueFrom } from "rxjs";

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
export class SendComponent implements OnInit {
  private sendFormConfigService = inject(DefaultSendFormConfigService);
  private sendItemsService = inject(SendItemsService);
  private policyService = inject(PolicyService);
  private accountService = inject(AccountService);
  private i18nService = inject(I18nService);
  private platformUtilsService = inject(PlatformUtilsService);
  private environmentService = inject(EnvironmentService);
  private sendApiService = inject(SendApiService);
  private dialogService = inject(DialogService);
  private toastService = inject(ToastService);
  private logService = inject(LogService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);

  private activeDrawerRef?: DialogRef<SendItemDialogResult>;

  protected readonly filteredSends = toSignal(this.sendItemsService.filteredAndSortedSends$, {
    initialValue: [],
  });

  protected readonly loading = toSignal(this.sendItemsService.loading$, { initialValue: true });

  protected readonly currentSearchText = toSignal(this.sendItemsService.latestSearchText$, {
    initialValue: "",
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

  async ngOnInit(): Promise<void> {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const sendPathsParam = params["sendPaths"];
      if (sendPathsParam) {
        try {
          const paths = JSON.parse(sendPathsParam) as string[];
          if (paths.length > 0) {
            void this.openSendFromPaths(paths);
          }
        } catch (e) {
          this.logService.error("Error parsing sendPaths: " + e);
        }
      }
    });
  }

  private async openSendFromPaths(filePaths: string[]): Promise<void> {
    try {
      const pathInfos = await Promise.all(
        filePaths.map(async (fp) => {
          const info = await ipc.platform.sendFile.getPathInfo(fp);
          return {
            path: fp,
            isDirectory: info.isDirectory,
            name: info.name,
            size: info.size,
          };
        }),
      );

      const formConfig = await this.sendFormConfigService.buildConfig(
        "add",
        undefined,
        SendType.File,
      );

      // Single directory → folder-mode (shows folder picker UI + "New Folder Send" header).
      // Mixed selections (files + dirs, or multiple of either) stay in file-mode
      // where the file-details component displays a summary like "5 files, 2.4 MB"
      // and everything gets zipped together on submit.
      if (pathInfos.length === 1 && pathInfos[0].isDirectory) {
        formConfig.isFolderMode = true;
      }

      formConfig.preloadedPaths = pathInfos;

      this.activeDrawerRef = SendAddEditDialogComponent.openDrawer(this.dialogService, {
        formConfig,
      });

      await lastValueFrom(this.activeDrawerRef.closed);
      this.activeDrawerRef = null;
    } catch (e) {
      this.logService.error("Error opening send from paths: " + e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("unexpectedError"),
      });
    }
  }

  protected async addSend(type: SendType): Promise<void> {
    const formConfig = await this.sendFormConfigService.buildConfig("add", undefined, type);

    this.activeDrawerRef = SendAddEditDialogComponent.openDrawer(this.dialogService, {
      formConfig,
    });

    await lastValueFrom(this.activeDrawerRef.closed);
    this.activeDrawerRef = null;
  }

  protected async addFolderSend(): Promise<void> {
    const formConfig = await this.sendFormConfigService.buildConfig(
      "add",
      undefined,
      SendType.File,
    );
    formConfig.isFolderMode = true;

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
