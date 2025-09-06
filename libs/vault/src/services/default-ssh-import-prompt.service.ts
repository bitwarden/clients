import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SshKeyApi } from "@bitwarden/common/vault/models/api/ssh-key.api";
import { SshKeyData } from "@bitwarden/common/vault/models/data/ssh-key.data";
import { DialogService, ToastService } from "@bitwarden/components";
import { SshKeyPasswordPromptComponent } from "@bitwarden/importer-ui";
import { import_ssh_key, SshKeyImportError, SshKeyView } from "@bitwarden/sdk-internal";

import { SshImportPromptService } from "./ssh-import-prompt.service";

/**
 * Used to import ssh keys and prompt for their password.
 */
@Injectable()
export class DefaultSshImportPromptService implements SshImportPromptService {
  constructor(
    private dialogService: DialogService,
    private toastService: ToastService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
  ) {}

  async importSshKeyFromClipboard(): Promise<SshKeyData | null> {
    const key = await this.platformUtilsService.readFromClipboard();

    let isPasswordProtectedSshKey = false;

    let parsedKey: SshKeyView | null = null;

    try {
      parsedKey = import_ssh_key(key);
    } catch (e) {
      const error = e as SshKeyImportError;
      if (error.variant === "PasswordRequired" || error.variant === "WrongPassword") {
        isPasswordProtectedSshKey = true;
      } else {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t(this.sshImportErrorVariantToI18nKey(error.variant)),
        });
        return null;
      }
    }

    if (isPasswordProtectedSshKey) {
      for (;;) {
        const result = await this.getSshKeyPassword();
        if (!result || result.password == null || result.password === "") {
          return null;
        }

        try {
          parsedKey = import_ssh_key(key, result.password);
          // Carry user's remember preference and provided passphrase forward
          (parsedKey as any).__rememberPassphrase = result.rememberPassphrase === true;
          (parsedKey as any).__providedPassphrase = result.password;
          break;
        } catch (e) {
          const error = e as SshKeyImportError;
          if (error.variant !== "WrongPassword") {
            this.toastService.showToast({
              variant: "error",
              title: "",
              message: this.i18nService.t(this.sshImportErrorVariantToI18nKey(error.variant)),
            });
            return null;
          }
        }
      }
    }

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("sshKeyImported"),
    });

    // If user opted to remember passphrase, persist it with the item; otherwise do not store it.
    const remember = (parsedKey as any).__rememberPassphrase === true;
    const provided = (parsedKey as any).__providedPassphrase as string | undefined;

    return new SshKeyData(
      new SshKeyApi({
        privateKey: parsedKey!.privateKey,
        publicKey: parsedKey!.publicKey,
        keyFingerprint: parsedKey!.fingerprint,
        // Preserve metadata from SDK for fidelity and UX
        originalPrivateKey: (parsedKey as any).originalPrivateKey,
        isEncrypted: (parsedKey as any).isEncrypted,
        sshKeyPassphrase: remember ? provided : undefined,
      }),
    );
  }

  private sshImportErrorVariantToI18nKey(variant: string): string {
    switch (variant) {
      case "ParsingError":
        return "invalidSshKey";
      case "UnsupportedKeyType":
        return "sshKeyTypeUnsupported";
      case "PasswordRequired":
      case "WrongPassword":
        return "sshKeyWrongPassword";
      default:
        return "errorOccurred";
    }
  }

  private async getSshKeyPassword(): Promise<{ password: string; rememberPassphrase: boolean } | undefined> {
    const dialog = this.dialogService.open<{ password: string; rememberPassphrase: boolean }>(SshKeyPasswordPromptComponent, {
      ariaModal: true,
    });

    return await firstValueFrom(dialog.closed);
  }
}
