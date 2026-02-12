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

export const VaultWelcomeDialogResult = {
  Dismissed: "dismissed",
  GetStarted: "getStarted",
} as const;

export type VaultWelcomeDialogResult =
  (typeof VaultWelcomeDialogResult)[keyof typeof VaultWelcomeDialogResult];

@Component({
  selector: "app-vault-welcome-dialog",
  templateUrl: "./vault-welcome-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, TypographyModule, JslibModule],
})
export class VaultWelcomeDialogComponent {
  constructor(private dialogRef: DialogRef<VaultWelcomeDialogResult>) {}

  protected onDismiss(): void {
    this.dialogRef.close(VaultWelcomeDialogResult.Dismissed);
  }

  protected onPrimaryCta(): void {
    this.dialogRef.close(VaultWelcomeDialogResult.GetStarted);
  }

  static open(dialogService: DialogService): DialogRef<VaultWelcomeDialogResult> {
    return dialogService.open<VaultWelcomeDialogResult>(VaultWelcomeDialogComponent, {
      disableClose: true,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
