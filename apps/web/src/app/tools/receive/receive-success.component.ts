import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { ActiveSendIcon } from "@bitwarden/assets/svg";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { buildReceiveUrl } from "@bitwarden/common/tools/receive/models/receive-url-data";
import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import {
  ButtonModule,
  CopyClickDirective,
  DIALOG_DATA,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  SvgModule,
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
    CopyClickDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveSuccessComponent {
  protected readonly activeReceiveIcon = ActiveSendIcon;
  protected readonly receive = inject<ReceiveView>(DIALOG_DATA);

  private readonly environmentService = inject(EnvironmentService);

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
}
