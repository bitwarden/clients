import { DatePipe } from "@angular/common";
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  signal,
  viewChild,
  AfterViewInit,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, map } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { A11yTitleDirective, DialogService, ToastService } from "@bitwarden/components";
import { SendItemsService } from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { invokeMenu, RendererMenuItem } from "../../../utils";
import { AddEditComponent } from "../send/add-edit.component";

@Component({
  selector: "app-send-v2",
  imports: [DatePipe, I18nPipe, AddEditComponent, A11yTitleDirective],
  templateUrl: "send-v2.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendV2Component implements AfterViewInit {
  protected readonly sendType = SendType;
  protected readonly addEditComponent = viewChild(AddEditComponent);
  protected readonly filteredSends = toSignal(this.sendItemsService.filteredAndSortedSends$, {
    initialValue: [],
  });
  protected readonly loaded = toSignal(
    this.sendItemsService.loading$.pipe(map((loading) => !loading)),
    { initialValue: false },
  );
  protected readonly sendId = signal<string | null>(null);
  protected readonly action = signal<"add" | "edit" | null>(null);

  // Track pending add operation with type
  private readonly pendingAddType = signal<SendType | null>(null);

  // Get the selectedSendType based on current action and sendId
  protected readonly selectedSendType = computed(() => {
    // If adding, use pending type
    if (this.action() === "add") {
      return this.pendingAddType();
    }

    // If editing, find type from send
    const id = this.sendId();
    if (!id) {
      return null;
    }
    return this.filteredSends()?.find((s) => s.id === id)?.type ?? null;
  });

  constructor(
    protected sendItemsService: SendItemsService,
    private dialogService: DialogService,
    private environmentService: EnvironmentService,
    private i18nService: I18nService,
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
    private sendApiService: SendApiService,
    private toastService: ToastService,
  ) {}

  ngAfterViewInit(): void {
    // Handle pending add operation after view initializes
    if (this.action() === "add" && this.pendingAddType() !== null) {
      void this.initializeAddEdit(this.pendingAddType());
      this.pendingAddType.set(null);
    }
  }

  // Select a Send to view/edit
  protected async selectSend(sendId: string): Promise<void> {
    if (sendId === this.sendId() && this.action() === "edit") {
      return;
    }
    this.action.set("edit");
    this.sendId.set(sendId);

    const component = this.addEditComponent();
    if (component) {
      component.sendId = sendId;
      await component.refresh();
    }
  }

  // Create a new Send with optional type
  protected addSend(type?: SendType): void {
    this.action.set("add");
    this.sendId.set(null);

    // Store the type for initialization after view renders
    this.pendingAddType.set(type ?? null);

    // If component already exists (shouldn't happen on first add, but handle it)
    const component = this.addEditComponent();
    if (component) {
      void this.initializeAddEdit(type);
    }
  }

  // Initialize the add-edit component with optional type
  private async initializeAddEdit(type?: SendType | null): Promise<void> {
    const component = this.addEditComponent();
    if (!component) {
      return;
    }

    // Set type if provided
    if (type !== null && type !== undefined) {
      component.type = type;
    }

    await component.resetAndLoad();
  }

  // Save completion (after create or modify)
  protected async savedSend(send: SendView): Promise<void> {
    this.pendingAddType.set(null);
    await this.selectSend(send.id);
  }

  // Cancel (close add/edit panel)
  protected cancel(): void {
    this.action.set(null);
    this.sendId.set(null);
    this.pendingAddType.set(null);
  }

  // Delete completion (after delete)
  protected async deletedSend(): Promise<void> {
    this.action.set(null);
    this.sendId.set(null);
    this.pendingAddType.set(null);
  }

  // Context menu for send items
  protected viewSendMenu(send: SendView): void {
    const menu: RendererMenuItem[] = [];

    // Copy Link
    menu.push({
      label: this.i18nService.t("copyLink"),
      click: () => this.copySendLink(send),
    });

    // Remove Password (only if send has password and isn't disabled)
    if (send.password && !send.disabled) {
      menu.push({
        label: this.i18nService.t("removePassword"),
        click: async () => {
          await this.removePassword(send);
          // Refresh the send to show updated state
          if (this.sendId() === send.id) {
            await this.selectSend(send.id);
          }
        },
      });
    }

    // Delete
    menu.push({
      label: this.i18nService.t("delete"),
      click: async () => {
        const deleted = await this.deleteSend(send);
        if (deleted) {
          await this.deletedSend();
        }
      },
    });

    invokeMenu(menu);
  }

  // Copy send link to clipboard
  private async copySendLink(send: SendView): Promise<void> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const link = env.getSendUrl() + send.accessId + "/" + send.urlB64Key;
    this.platformUtilsService.copyToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
    });
  }

  // Remove password from a send
  private async removePassword(send: SendView): Promise<boolean> {
    if (send.password == null) {
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
      await this.sendApiService.removePassword(send.id);
      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("removedPassword"),
      });
      return true;
    } catch (e) {
      this.logService.error(e);
      return false;
    }
  }

  // Delete a send
  private async deleteSend(send: SendView): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      await this.sendApiService.delete(send.id);
      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("deletedSend"),
      });
      return true;
    } catch (e) {
      this.logService.error(e);
      return false;
    }
  }
}
