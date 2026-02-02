import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
  CenterPositionStrategy,
} from "@bitwarden/components";

export type VaultWelcomeDialogParams = {
  showTourCta?: boolean;
};

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
  protected readonly showTourCta: boolean;

  constructor(
    private dialogRef: DialogRef<VaultWelcomeDialogResult>,
    @Inject(DIALOG_DATA) params?: VaultWelcomeDialogParams,
  ) {
    this.showTourCta = params?.showTourCta ?? false;
  }

  protected onDismiss(): void {
    this.dialogRef.close(VaultWelcomeDialogResult.Dismissed);
  }

  protected onPrimaryCta(): void {
    this.dialogRef.close(VaultWelcomeDialogResult.GetStarted);
  }

  static open(
    dialogService: DialogService,
    dialogConfig?: DialogConfig<VaultWelcomeDialogParams>,
  ): DialogRef<VaultWelcomeDialogResult> {
    return dialogService.open<VaultWelcomeDialogResult>(VaultWelcomeDialogComponent, {
      ...(dialogConfig ?? {}),
      data: dialogConfig?.data,
      disableClose: true,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
