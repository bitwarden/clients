import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  UserVerificationDialogComponent,
  UserVerificationDialogResult,
} from "@bitwarden/auth/angular";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { VerificationWithSecret } from "@bitwarden/common/auth/types/verification";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";

@Component({
  selector: "app-rotate-account-user-key",
  templateUrl: "rotate-account-user-key.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    ReactiveFormsModule,
    ButtonModule,
    FormFieldModule,
    AsyncActionsModule,
    IconButtonModule,
  ],
})
export class RotateAccountUserKeyComponent {
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly masterPasswordUnlockService = inject(MasterPasswordUnlockService);

  private readonly currentMasterPassword: string;

  readonly rotateKey = async () => {
    const result = await this.preformUserVerification();
    if (result.userAction === "cancel") {
      return;
    }
    if (!result.verificationSuccess) {
      return;
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("accountEncryptionKeyRotated"),
    });
  };

  private async rotateUserKey() {
    // How to fetch master password hint?
  }

  private async preformUserVerification(): Promise<UserVerificationDialogResult> {
    return await UserVerificationDialogComponent.open(this.dialogService, {
      title: "rotateAccountEncryptionKey",
      bodyText: "rotateAccountEncryptionKeyDescription",
      calloutOptions: {
        text: "rotateAccountEncryptionKeyWarning",
        type: "warning",
      },
      confirmButtonOptions: {
        text: "rotateKey",
        type: "primary",
      },
      verificationType: {
        type: "custom",
        verificationFn: async (secret: VerificationWithSecret) => {
          const activeUserId = (await firstValueFrom(this.accountService.activeAccount$)).id;

          if (secret.type === VerificationType.MasterPassword) {
            const hasProofOfDecryption = await this.masterPasswordUnlockService.proofOfDecryption(
              secret.secret,
              activeUserId,
            );

            if (hasProofOfDecryption) {
              this.currentMasterPassword = secret.secret;
              return true;
            }
          }

          return false;
        },
      },
    });
  }
}
