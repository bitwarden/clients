import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DIALOG_DATA,
  ButtonModule,
  DialogModule,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";

import { DuoMethod } from "../../../importers/keeper/access";

type KeeperDuoPushPromptData = {
  method: DuoMethod;
};

@Component({
  templateUrl: "keeper-duo-push-prompt.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperDuoPushPromptComponent {
  private readonly data = inject<KeeperDuoPushPromptData>(DIALOG_DATA);

  private readonly method = this.data.method;

  protected get descriptionI18nKey(): string {
    switch (this.method) {
      case DuoMethod.Push:
        return "duoPushWaiting";
      case DuoMethod.Sms:
        return "duoSmsWaiting";
      case DuoMethod.Voice:
        return "duoVoiceWaiting";
      default:
        return "duoPushWaiting";
    }
  }

  static open(dialogService: DialogService, data: KeeperDuoPushPromptData) {
    return dialogService.open<string>(KeeperDuoPushPromptComponent, { data });
  }
}
