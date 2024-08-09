import { CommonModule, Location } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { ButtonModule, IconModule, ToastService } from "@bitwarden/components";
import { SendCreatedIcon } from "@bitwarden/send-ui";

import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

@Component({
  selector: "app-send-created",
  templateUrl: "./send-created.component.html",
  standalone: true,
  imports: [
    ButtonModule,
    CommonModule,
    JslibModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    RouterLink,
    PopupFooterComponent,
    IconModule,
  ],
})
export class SendCreatedComponent {
  protected sendCreatedIcon = SendCreatedIcon;
  protected send: SendView;
  protected daysAvailable = 0;

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private sendService: SendService,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private location: Location,
    private environmentService: EnvironmentService,
  ) {
    const sendId = this.route.snapshot.queryParamMap.get("sendId");
    this.sendService.sendViews$.pipe(takeUntilDestroyed()).subscribe((sendViews) => {
      this.send = sendViews.find((s) => s.id === sendId);
      if (this.send) {
        this.daysAvailable = this.getDaysAvailable(this.send);
      }
    });
  }

  getDaysAvailable(send: SendView): number {
    const now = new Date().getTime();
    return Math.max(0, Math.ceil((send.deletionDate.getTime() - now) / (1000 * 60 * 60 * 24)));
  }

  close() {
    this.location.back();
  }

  async copyLink() {
    if (!this.send || !this.send.accessId || !this.send.urlB64Key) {
      return;
    }
    const env = await firstValueFrom(this.environmentService.environment$);
    const link = env.getSendUrl() + this.send.accessId + "/" + this.send.urlB64Key;
    this.platformUtilsService.copyToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("sendLinkCopied"),
    });
  }
}
