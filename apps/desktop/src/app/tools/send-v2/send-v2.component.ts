import { DatePipe } from "@angular/common";
import { Component, ChangeDetectionStrategy, computed, signal, viewChild } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, map } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { A11yTitleDirective, DialogService, ToastService } from "@bitwarden/components";
import { SendItemsService, SendListFiltersService } from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { invokeMenu, RendererMenuItem } from "../../../utils";
import { AddEditComponent } from "../send/add-edit.component";

@Component({
  selector: "app-send-v2",
  imports: [DatePipe, I18nPipe, AddEditComponent, A11yTitleDirective],
  templateUrl: "send-v2.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendV2Component {
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

  // Get the selectedSendType based on current sendId
  protected readonly selectedSendType = computed(() => {
    const id = this.sendId();
    if (!id) {
      return null;
    }
    return this.filteredSends()?.find((s) => s.id === id)?.type ?? null;
  });

  constructor(
    protected sendItemsService: SendItemsService,
    protected sendListFiltersService: SendListFiltersService,
    private dialogService: DialogService,
    private environmentService: EnvironmentService,
    private i18nService: I18nService,
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
    private sendApiService: SendApiService,
    private toastService: ToastService,
  ) {}

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

  // Create a new Send
  protected async addSend(): Promise<void> {
    this.action.set("add");
    this.sendId.set(null);

    const component = this.addEditComponent();
    if (component) {
      await component.resetAndLoad();
    }
  }

  // Save completion (after create or modify)
  protected async savedSend(send: SendView): Promise<void> {
    await this.selectSend(send.id);
  }

  // Cancel (close add/edit panel)
  protected cancel(_send: SendView): void {
    this.action.set(null);
    this.sendId.set(null);
  }

  // Delete completion (after delete)
  protected async deletedSend(_send: SendView): Promise<void> {
    this.action.set(null);
    this.sendId.set(null);
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
          await this.deletedSend(send);
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
      title: null,
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
        title: null,
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
        title: null,
        message: this.i18nService.t("deletedSend"),
      });
      return true;
    } catch (e) {
      this.logService.error(e);
      return false;
    }
  }
}
