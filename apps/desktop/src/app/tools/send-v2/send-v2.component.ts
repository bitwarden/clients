// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, computed, DestroyRef, inject, signal, viewChild } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, switchMap, lastValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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
import { AddEditComponent } from "../send/add-edit.component";

const Action = Object.freeze({
  /** No action is currently active. */
  None: "",
  /** The user is adding a new Send. */
  Add: "add",
  /** The user is editing an existing Send. */
  Edit: "edit",
} as const);

type Action = (typeof Action)[keyof typeof Action];

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send-v2",
  imports: [
    JslibModule,
    ButtonModule,
    AddEditComponent,
    SendListComponent,
    NewSendDropdownV2Component,
    DesktopHeaderComponent,
  ],
  providers: [
    DefaultSendFormConfigService,
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
  ],
  templateUrl: "./send-v2.component.html",
})
export class SendV2Component {
  protected readonly addEditComponent = viewChild(AddEditComponent);

  protected readonly sendId = signal<string | null>(null);
  protected readonly action = signal<Action>(Action.None);

  private sendFormConfigService = inject(DefaultSendFormConfigService);
  private sendItemsService = inject(SendItemsService);
  private policyService = inject(PolicyService);
  private accountService = inject(AccountService);
  private configService = inject(ConfigService);
  private i18nService = inject(I18nService);
  private platformUtilsService = inject(PlatformUtilsService);
  private environmentService = inject(EnvironmentService);
  private sendApiService = inject(SendApiService);
  private dialogService = inject(DialogService);
  private toastService = inject(ToastService);
  private logService = inject(LogService);
  private destroyRef = inject(DestroyRef);

  private activeDrawerRef?: DialogRef<SendItemDialogResult>;

  protected readonly useDrawerEditMode = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.DesktopUiMigrationMilestone2),
    { initialValue: false },
  );

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

  protected readonly selectedSendType = computed(() => {
    const action = this.action();

    if (action === Action.Add) {
      return undefined;
    }

    const sendId = this.sendId();
    return this.filteredSends().find((s) => s.id === sendId)?.type;
  });

  protected async addSend(type: SendType): Promise<void> {
    if (this.useDrawerEditMode()) {
      const formConfig = await this.sendFormConfigService.buildConfig("add", undefined, type);

      this.activeDrawerRef = SendAddEditDialogComponent.openDrawer(this.dialogService, {
        formConfig,
      });

      await lastValueFrom(this.activeDrawerRef.closed);
      this.activeDrawerRef = null;
    } else {
      this.action.set(Action.Add);
      this.sendId.set(null);
      void this.addEditComponent()?.resetAndLoad();
    }
  }

  /** Used by old UI to add a send without specifying type (defaults to File) */
  protected async addSendWithoutType(): Promise<void> {
    await this.addSend(SendType.File);
  }

  protected closeEditPanel(): void {
    this.action.set(Action.None);
    this.sendId.set(null);
  }

  protected async savedSend(send: SendView): Promise<void> {
    await this.selectSend(send.id);
  }

  protected async selectSend(sendId: string): Promise<void> {
    if (this.useDrawerEditMode()) {
      const formConfig = await this.sendFormConfigService.buildConfig("edit", sendId as SendId);

      this.activeDrawerRef = SendAddEditDialogComponent.openDrawer(this.dialogService, {
        formConfig,
      });

      await lastValueFrom(this.activeDrawerRef.closed);
      this.activeDrawerRef = null;
    } else {
      if (sendId === this.sendId() && this.action() === Action.Edit) {
        return;
      }
      this.action.set(Action.Edit);
      this.sendId.set(sendId);
      const component = this.addEditComponent();
      if (component) {
        component.sendId = sendId;
        await component.refresh();
      }
    }
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

      if (!this.useDrawerEditMode() && this.sendId() === send.id) {
        this.sendId.set(null);
        await this.selectSend(send.id);
      }
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

    if (!this.useDrawerEditMode()) {
      this.closeEditPanel();
    }
  }
}
