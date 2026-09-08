import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SshKeyApi } from "@bitwarden/common/vault/models/api/ssh-key.api";
import { SshKeyData } from "@bitwarden/common/vault/models/data/ssh-key.data";
import { DialogService, ToastService } from "@bitwarden/components";
import { import_ssh_key, SshKeyImportError, SshKeyView } from "@bitwarden/sdk-internal";

import { SshImportPromptService } from "./ssh-import-prompt.service";

/**
 * Used to import ssh keys and prompt for their password.
 */
@Injectable()
export class DefaultSshImportPromptService implements SshImportPromptService {
  private static readonly ECDSA_KEY_TYPES = [
    "ecdsa-sha2-nistp256",
    "ecdsa-sha2-nistp384",
    "ecdsa-sha2-nistp521",
  ];

  constructor(
    private dialogService: DialogService,
    private toastService: ToastService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private configService: ConfigService,
    private logService: LogService,
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
        this.reportImportFailure(error.variant);
        return null;
      }
    }

    if (isPasswordProtectedSshKey) {
      for (;;) {
        const password = await this.getSshKeyPassword();
        if (password === "" || password == null) {
          return null;
        }

        try {
          parsedKey = import_ssh_key(key, password);
          break;
        } catch (e) {
          const error = e as SshKeyImportError;
          if (error.variant !== "WrongPassword") {
            this.reportImportFailure(error.variant);
            return null;
          }
        }
      }
    }

    const isEcdsaKey = DefaultSshImportPromptService.ECDSA_KEY_TYPES.some((type) =>
      parsedKey!.publicKey.startsWith(type),
    );
    if (isEcdsaKey) {
      const ecdsaEnabled = await this.configService.getFeatureFlag(FeatureFlag.SSHecdsa);
      if (!ecdsaEnabled) {
        this.reportImportFailure(
          "UnsupportedKeyType",
          "ECDSA key type is disabled by the SSHecdsa feature flag",
        );

        return null;
      }
    }

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("sshKeyImported"),
    });

    return new SshKeyData(
      new SshKeyApi({
        privateKey: parsedKey!.privateKey,
        publicKey: parsedKey!.publicKey,
        keyFingerprint: parsedKey!.fingerprint,
      }),
    );
  }

  /**
   * Logs the failure to the app log and shows the matching localized toast.
   *
   * Only the variant and an optional non-sensitive reason are logged — never the key itself.
   */
  private reportImportFailure(variant: string, reason?: string) {
    this.logService.error(`SSH key import failed: ${reason ?? variant}`);

    this.toastService.showToast({
      variant: "error",
      title: "",
      message: this.i18nService.t(this.sshImportErrorVariantToI18nKey(variant)),
    });
  }

  private sshImportErrorVariantToI18nKey(variant: string): string {
    switch (variant) {
      case "Parsing":
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

  private async getSshKeyPassword(): Promise<string | undefined> {
    // Imported here rather than at the top of the file on purpose. This service is provided
    // eagerly by every client, and `@bitwarden/importer-ui` is a barrel that re-exports
    // `ImportComponent` — so a static import dragged all 126 third-party importers (plus jszip
    // and papaparse) into each client's startup bundle to support a dialog that only opens when
    // someone pastes a password-protected SSH key. It also softens the `@bitwarden/vault` ->
    // `@bitwarden/importer` cycle noted in import.component.ts.
    const { SshKeyPasswordPromptComponent } = await import("@bitwarden/importer-ui");

    const dialog = this.dialogService.open<string>(SshKeyPasswordPromptComponent, {
      ariaModal: true,
    });

    return await firstValueFrom(dialog.closed);
  }
}
