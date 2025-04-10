// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import {
  BadgeModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

@Component({
  imports: [
    CommonModule,
    ItemModule,
    ButtonModule,
    BadgeModule,
    IconButtonModule,
    SectionComponent,
    TypographyModule,
    JslibModule,
    SectionHeaderComponent,
    RouterLink,
  ],
  selector: "app-send-list-items-container",
  templateUrl: "send-list-items-container.component.html",
  standalone: true,
})
export class SendListItemsContainerComponent {
  sendType = SendType;
  /**
   * The list of sends to display.
   */
  @Input()
  sends: SendView[] = [];

  @Input()
  headerText: string;

  constructor(
    protected dialogService: DialogService,
    protected environmentService: EnvironmentService,
    protected i18nService: I18nService,
    protected logService: LogService,
    protected platformUtilsService: PlatformUtilsService,
    protected sendApiService: SendApiService,
    protected toastService: ToastService,
  ) {}

  async deleteSend(s: SendView): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendPermanentConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    await this.sendApiService.delete(s.id);

    try {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedSend"),
      });
    } catch (e) {
      this.logService.error(e);
    }
  }

  async copySendLink(send: SendView) {
    const env = await firstValueFrom(this.environmentService.environment$);
    const link = env.getSendUrl() + send.accessId + "/" + send.urlB64Key;
    this.platformUtilsService.copyToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
    });
  }
}
