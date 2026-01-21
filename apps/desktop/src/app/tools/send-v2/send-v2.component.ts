// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, switchMap, lastValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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
import { ButtonModule, DialogService, ToastService } from "@bitwarden/components";
import {
  NewSendDropdownV2Component,
  SendItemsService,
  SendListComponent,
  SendListState,
  SendAddEditDialogComponent,
  DefaultSendFormConfigService,
} from "@bitwarden/send-ui";

import { DesktopPremiumUpgradePromptService } from "../../../services/desktop-premium-upgrade-prompt.service";
import { DesktopHeaderComponent } from "../../layout/header";

@Component({
  selector: "app-send-v2",
  imports: [
    JslibModule,
    ButtonModule,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendV2Component {
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
  private cdr = inject(ChangeDetectorRef);

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
    // WORKAROUND: Force change detection when data updates
    // This is needed because SendSearchComponent (shared lib) hasn't migrated to OnPush yet
    // and doesn't trigger CD properly when search/add operations complete
    // TODO: Remove this once SendSearchComponent migrates to OnPush (tracked in CL-764)
    effect(() => {
      this.filteredSends();
      this.cdr.markForCheck();
    });
  }

  protected async addSend(type: SendType): Promise<void> {
    const formConfig = await this.sendFormConfigService.buildConfig("add", undefined, type);

    const dialogRef = SendAddEditDialogComponent.openDrawer(this.dialogService, {
      formConfig,
    });

    await lastValueFrom(dialogRef.closed);
  }

  protected async selectSend(sendId: SendId): Promise<void> {
    const formConfig = await this.sendFormConfigService.buildConfig("edit", sendId);

    const dialogRef = SendAddEditDialogComponent.openDrawer(this.dialogService, {
      formConfig,
    });

    await lastValueFrom(dialogRef.closed);
  }

  protected async onEditSend(send: SendView): Promise<void> {
    await this.selectSend(send.id as SendId);
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
