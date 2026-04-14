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

import { DnaMethod } from "../../../importers/keeper/access";

type KeeperDnaMethodSelectData = {
  methods: DnaMethod[];
};

@Component({
  templateUrl: "keeper-dna-method-select.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperDnaMethodSelectComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly data = inject<KeeperDnaMethodSelectData>(DIALOG_DATA);

  protected readonly methods = this.data.methods;

  protected select(method: DnaMethod) {
    this.dialogRef.close(method);
  }

  protected getMethodLabel(method: DnaMethod): string {
    switch (method) {
      case DnaMethod.Push:
        return "pushNotification";
      case DnaMethod.Code:
        return "enterCodeManually";
      default:
        return "unknownMethod";
    }
  }

  static open(dialogService: DialogService, data: KeeperDnaMethodSelectData) {
    return dialogService.open<DnaMethod>(KeeperDnaMethodSelectComponent, { data });
  }
}
