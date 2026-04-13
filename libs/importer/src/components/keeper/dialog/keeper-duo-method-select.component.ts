import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

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

type KeeperDuoMethodSelectData = {
  methods: DuoMethod[];
  phoneNumber: string;
};

@Component({
  templateUrl: "keeper-duo-method-select.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperDuoMethodSelectComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly data = inject<KeeperDuoMethodSelectData>(DIALOG_DATA);

  protected readonly methods = this.data.methods;
  protected readonly phoneNumber = this.data.phoneNumber;

  protected select(method: DuoMethod) {
    this.dialogRef.close(method);
  }

  protected getMethodLabel(method: DuoMethod): string {
    switch (method) {
      case DuoMethod.Push:
        return "keeperDuoPush";
      case DuoMethod.Sms:
        return "textMessageSms";
      case DuoMethod.Voice:
        return "keeperDuoVoice";
      case DuoMethod.Passcode:
        return "passcode";
      default:
        return "unknownMethod";
    }
  }

  static open(dialogService: DialogService, data: KeeperDuoMethodSelectData) {
    return dialogService.open<DuoMethod>(KeeperDuoMethodSelectComponent, { data });
  }
}
