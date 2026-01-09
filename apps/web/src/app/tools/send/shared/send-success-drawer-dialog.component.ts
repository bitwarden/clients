import { Component, ChangeDetectionStrategy, Inject, signal, computed } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ActiveSendIcon } from "@bitwarden/assets/svg";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { DIALOG_DATA, DialogModule, ToastService, TypographyModule } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

@Component({
  imports: [SharedModule, DialogModule, TypographyModule],
  templateUrl: "./send-success-drawer-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendSuccessDrawerDialogComponent {
  readonly sendLink = signal<string>("");
  activeSendIcon = ActiveSendIcon;

  // Computed property to get the dialog title based on send type
  readonly dialogTitle = computed(() => {
    return this.send.type === SendType.Text ? "newTextSend" : "newFileSend";
  });

  constructor(
    @Inject(DIALOG_DATA) public send: SendView,
    private environmentService: EnvironmentService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
  ) {
    void this.initLink();
  }

  async initLink() {
    const env = await firstValueFrom(this.environmentService.environment$);
    this.sendLink.set(env.getSendUrl() + this.send.accessId + "/" + this.send.urlB64Key);
  }

  get formattedExpirationTime(): string {
    if (!this.send.deletionDate) {
      return "";
    }
    const hoursAvailable = this.getHoursAvailable(this.send);
    if (hoursAvailable < 24) {
      return hoursAvailable === 1
        ? this.i18nService.t("oneHour").toLowerCase()
        : this.i18nService.t("durationTimeHours", String(hoursAvailable)).toLowerCase();
    }
    const daysAvailable = Math.ceil(hoursAvailable / 24);
    return daysAvailable === 1
      ? this.i18nService.t("oneDay").toLowerCase()
      : this.i18nService.t("days", String(daysAvailable)).toLowerCase();
  }

  private getHoursAvailable(send: SendView): number {
    const now = new Date().getTime();
    const deletionDate = new Date(send.deletionDate).getTime();
    return Math.max(0, Math.ceil((deletionDate - now) / (1000 * 60 * 60)));
  }

  copyLink() {
    const link = this.sendLink();
    if (!link) {
      return;
    }
    this.platformUtilsService.copyToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
    });
  }
}
