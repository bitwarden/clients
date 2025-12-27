// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ButtonModule, DialogService, ToastService } from "@bitwarden/components";
import {
  NewSendDropdownV2Component,
  SendItemsService,
  SendListComponent,
  SendListState,
} from "@bitwarden/send-ui";

import { DesktopPremiumUpgradePromptService } from "../../../services/desktop-premium-upgrade-prompt.service";
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

@Component({
  selector: "app-send-v2",
  imports: [
    JslibModule,
    ButtonModule,
    AddEditComponent,
    SendListComponent,
    NewSendDropdownV2Component,
  ],
  providers: [
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
  ],
  templateUrl: "./send-v2.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendV2Component {
  protected readonly addEditComponent = viewChild(AddEditComponent);

  protected readonly sendId = signal<string | null>(null);
  protected readonly action = signal<Action>(Action.None);
  private readonly selectedSendTypeOverride = signal<SendType | undefined>(undefined);

  private sendItemsService = inject(SendItemsService);
  private policyService = inject(PolicyService);
  private accountService = inject(AccountService);
  private i18nService = inject(I18nService);
  private platformUtilsService = inject(PlatformUtilsService);
  private environmentService = inject(EnvironmentService);
  private logService = inject(LogService);
  private sendApiService = inject(SendApiService);
  private dialogService = inject(DialogService);
  private toastService = inject(ToastService);
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
    this.action.set(Action.Add);
    this.sendId.set(null);
    this.selectedSendTypeOverride.set(type);

    const component = this.addEditComponent();
    if (component) {
      await component.resetAndLoad();
    }
  }

  protected closeEditPanel(): void {
    this.action.set(Action.None);
    this.sendId.set(null);
    this.selectedSendTypeOverride.set(undefined);
  }

  protected async savedSend(send: SendView): Promise<void> {
    await this.selectSend(send.id);
  }

  protected async selectSend(sendId: string): Promise<void> {
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

  protected readonly selectedSendType = computed(() => {
    const action = this.action();
    const typeOverride = this.selectedSendTypeOverride();

    if (action === Action.Add && typeOverride !== undefined) {
      return typeOverride;
    }

    const sendId = this.sendId();
    return this.filteredSends().find((s) => s.id === sendId)?.type;
  });

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

      if (this.sendId() === send.id) {
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

    this.closeEditPanel();
  }
}
