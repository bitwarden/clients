import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DIALOG_DATA,
  ButtonModule,
  DialogModule,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";

@Component({
  templateUrl: "keeper-error.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperErrorComponent {
  private readonly data = inject<{ messageKey: string }>(DIALOG_DATA);

  protected readonly messageKey = this.data.messageKey;

  static open(dialogService: DialogService, messageKey: string): Promise<void> {
    const dialogRef = dialogService.open(KeeperErrorComponent, {
      data: { messageKey },
    });
    return firstValueFrom(dialogRef.closed).then(() => {});
  }
}
