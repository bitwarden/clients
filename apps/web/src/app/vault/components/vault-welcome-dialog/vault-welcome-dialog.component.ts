import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
  CenterPositionStrategy,
} from "@bitwarden/components";
import { StateProvider, UserKeyDefinition, VAULT_WELCOME_DIALOG_DISK } from "@bitwarden/state";

export const VaultWelcomeDialogResult = {
  Dismissed: "dismissed",
  GetStarted: "getStarted",
} as const;

export type VaultWelcomeDialogResult =
  (typeof VaultWelcomeDialogResult)[keyof typeof VaultWelcomeDialogResult];

const VAULT_WELCOME_DIALOG_ACKNOWLEDGED_KEY = new UserKeyDefinition<boolean>(
  VAULT_WELCOME_DIALOG_DISK,
  "vaultWelcomeDialogAcknowledged",
  {
    deserializer: (value) => value,
    clearOn: [],
  },
);

@Component({
  selector: "app-vault-welcome-dialog",
  templateUrl: "./vault-welcome-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, TypographyModule, JslibModule],
})
export class VaultWelcomeDialogComponent {
  private accountService = inject(AccountService);
  private stateProvider = inject(StateProvider);

  constructor(private dialogRef: DialogRef<VaultWelcomeDialogResult>) {}

  protected async onDismiss(): Promise<void> {
    await this.setAcknowledged();
    this.dialogRef.close(VaultWelcomeDialogResult.Dismissed);
  }

  protected async onPrimaryCta(): Promise<void> {
    await this.setAcknowledged();
    this.dialogRef.close(VaultWelcomeDialogResult.GetStarted);
  }

  private async setAcknowledged(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.stateProvider.setUserState(VAULT_WELCOME_DIALOG_ACKNOWLEDGED_KEY, true, userId);
  }

  static open(dialogService: DialogService): DialogRef<VaultWelcomeDialogResult> {
    return dialogService.open<VaultWelcomeDialogResult>(VaultWelcomeDialogComponent, {
      disableClose: true,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
