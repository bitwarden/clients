// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewChild,
  inject,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
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
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { ButtonModule, DialogService, ToastService } from "@bitwarden/components";
import {
  SendItemsService,
  SendListComponent,
  SendListFiltersService,
  SendListState,
} from "@bitwarden/send-ui";

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
    CommonModule,
    JslibModule,
    FormsModule,
    ButtonModule,
    AddEditComponent,
    SendListComponent,
  ],
  templateUrl: "./send-v2.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendV2Component {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(AddEditComponent) addEditComponent: AddEditComponent;

  // The ID of the currently selected Send item being viewed or edited
  protected sendId: string;

  // Tracks the current UI state: viewing list (None), adding new Send (Add), or editing existing Send (Edit)
  protected action: Action = Action.None;

  // Services injected using inject() pattern
  private sendItemsService = inject(SendItemsService);
  private sendListFiltersService = inject(SendListFiltersService);
  private sendService = inject(SendService);
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

  // Convert Observables to Signals
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

  constructor() {
    // Subscribe to send changes and manually trigger change detection
    // This is necessary because SendService updates might not automatically trigger OnPush
    this.sendService.sendViews$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.cdr.markForCheck();
    });
  }

  // Open the add Send form to create a new Send item
  protected async addSend(): Promise<void> {
    this.action = Action.Add;
    if (this.addEditComponent != null) {
      await this.addEditComponent.resetAndLoad();
    }
  }

  // Close the add/edit form and return to the list view
  protected closeEditPanel(): void {
    this.action = Action.None;
    this.sendId = null;
  }

  // Handle when a Send is saved: re-select the saved Send
  protected async savedSend(s: SendView): Promise<void> {
    await this.selectSend(s.id);
  }

  // Select a Send from the list and open it in the edit form
  protected async selectSend(sendId: string): Promise<void> {
    if (sendId === this.sendId && this.action === Action.Edit) {
      return;
    }
    this.action = Action.Edit;
    this.sendId = sendId;
    if (this.addEditComponent != null) {
      this.addEditComponent.sendId = sendId;
      await this.addEditComponent.refresh();
    }
  }

  // Get the type (text or file) of the currently selected Send for the edit form
  protected get selectedSendType(): SendType {
    return this.filteredSends().find((s) => s.id === this.sendId)?.type;
  }

  // Event handlers from SendListComponent
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

      // If this is the currently selected send, refresh it
      if (this.sendId === send.id) {
        this.sendId = null;
        await this.selectSend(send.id);
      }
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected async onDeleteSend(send: SendView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendPermanentConfirmation" },
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
