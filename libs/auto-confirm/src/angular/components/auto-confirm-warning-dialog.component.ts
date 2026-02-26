// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";

import {
  ButtonModule,
  CenterPositionStrategy,
  DialogModule,
  DialogService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./auto-confirm-warning-dialog.component.html",
  imports: [ButtonModule, DialogModule, CommonModule, I18nPipe],
})
export class AutoConfirmWarningDialogComponent {
  constructor(public dialogRef: DialogRef<boolean>) {}

  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(AutoConfirmWarningDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
