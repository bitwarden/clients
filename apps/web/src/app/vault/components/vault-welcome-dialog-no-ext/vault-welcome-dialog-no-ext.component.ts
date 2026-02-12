import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
  CenterPositionStrategy,
} from "@bitwarden/components";

export const VaultWelcomeDialogNoExtResult = {
  Dismissed: "dismissed",
  GetStarted: "getStarted",
} as const;

export type VaultWelcomeDialogNoExtResult =
  (typeof VaultWelcomeDialogNoExtResult)[keyof typeof VaultWelcomeDialogNoExtResult];

@Component({
  selector: "app-vault-welcome-dialog-no-ext",
  templateUrl: "./vault-welcome-dialog-no-ext.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, TypographyModule, JslibModule],
})
export class VaultWelcomeDialogNoExtComponent {
  constructor(private dialogRef: DialogRef<VaultWelcomeDialogNoExtResult>) {}

  protected onDismiss(): void {
    this.dialogRef.close(VaultWelcomeDialogNoExtResult.Dismissed);
  }

  protected onPrimaryCta(): void {
    this.dialogRef.close(VaultWelcomeDialogNoExtResult.GetStarted);
  }

  static open(dialogService: DialogService): DialogRef<VaultWelcomeDialogNoExtResult> {
    return dialogService.open<VaultWelcomeDialogNoExtResult>(VaultWelcomeDialogNoExtComponent, {
      disableClose: true,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
