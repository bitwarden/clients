import { ChangeDetectionStrategy, Component, computed, Inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { ActiveSendIcon } from "@bitwarden/assets/svg";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { buildReceiveUrl } from "@bitwarden/common/tools/receive/models/receive-url-data";
import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  SvgModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  templateUrl: "./receive-success.component.html",
  imports: [
    DialogModule,
    ButtonModule,
    FormFieldModule,
    IconButtonModule,
    SvgModule,
    TypographyModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveSuccessComponent {
  protected readonly activeReceiveIcon = ActiveSendIcon;

  private readonly baseReceiveUrl = toSignal(
    this.environmentService.environment$.pipe(map((env) => env.getWebVaultUrl() + "/#/receive")),
  );

  protected readonly receiveLink = computed(() => {
    const baseUrl = this.baseReceiveUrl();
    if (!baseUrl) {
      return null;
    }
    return buildReceiveUrl(this.receive, baseUrl);
  });

  constructor(
    @Inject(DIALOG_DATA) protected readonly receive: ReceiveView,
    private readonly environmentService: EnvironmentService,
    private readonly i18nService: I18nService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly toastService: ToastService,
  ) {}

  protected copyLink(): void {
    const link = this.receiveLink();
    if (!link) {
      return;
    }
    this.platformUtilsService.copyToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("receiveLink")),
    });
  }
}
