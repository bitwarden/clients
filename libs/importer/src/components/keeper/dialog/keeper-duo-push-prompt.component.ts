import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DIALOG_DATA,
  DialogRef,
  ButtonModule,
  DialogModule,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";

import { DuoMethod } from "../../../importers/keeper/access";

type KeeperDuoPushPromptData = {
  method: DuoMethod;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "keeper-duo-push-prompt.component.html",
  imports: [CommonModule, JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperDuoPushPromptComponent {
  private method = this.data.method;

  protected get descriptionI18nKey(): string {
    switch (this.method) {
      case DuoMethod.Push:
        return "keeperDuoPushWaiting";
      case DuoMethod.Sms:
        return "keeperDuoSmsWaiting";
      case DuoMethod.Voice:
        return "keeperDuoVoiceWaiting";
      default:
        return "keeperDuoPushWaiting";
    }
  }

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: KeeperDuoPushPromptData,
  ) {}

  static open(dialogService: DialogService, data: KeeperDuoPushPromptData) {
    return dialogService.open<string>(KeeperDuoPushPromptComponent, { data });
  }
}
