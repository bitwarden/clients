import { Component, Inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DIALOG_DATA,
  ButtonModule,
  DialogModule,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "keeper-error.component.html",
  imports: [JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperErrorComponent {
  protected messageKey = this.data.messageKey;

  constructor(@Inject(DIALOG_DATA) protected data: { messageKey: string }) {}

  static open(dialogService: DialogService, messageKey: string): Promise<void> {
    const dialogRef = dialogService.open(KeeperErrorComponent, {
      data: { messageKey },
    });
    return firstValueFrom(dialogRef.closed).then(() => {});
  }
}
