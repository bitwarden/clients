import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { ActiveSendIcon } from "@bitwarden/assets/svg";
import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import { ReceiveService } from "@bitwarden/common/tools/receive/services/receive.service";
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
  private readonly receiveService = inject(ReceiveService);

  protected readonly receiveLink = toSignal(this.receiveService.buildReceiveUrl$(this.receive));
}
