// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { BiometricsStatus, KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";
import { I18nService } from "../../platform/services/i18n.service";
import { CliUtils } from "../../utils";
import { CliBiometricsService } from "../cli-biometrics-service";
import { ConvertToKeyConnectorCommand } from "../convert-to-key-connector.command";

export class UnlockCommand {
  constructor(
    private accountService: AccountService,
    private keyService: KeyService,
    private cryptoFunctionService: CryptoFunctionService,
    private logService: ConsoleLogService,
    private keyConnectorService: KeyConnectorService,
    private environmentService: EnvironmentService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private logout: () => Promise<void>,
    private i18nService: I18nService,
    private encryptedMigrator: EncryptedMigrator,
    private masterPasswordUnlockService: MasterPasswordUnlockService,
    private biometricsService: CliBiometricsService,
  ) {}

  async run(password: string, cmdOptions: Record<string, any>) {
    const normalizedOptions = new Options(cmdOptions);

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (activeAccount == null) {
      return Response.error("No active account found");
    }
    const userId = activeAccount.id;

    // If password is explicitly provided, use it directly (backwards compatible)
    const passwordExplicitlyProvided =
      !Utils.isNullOrEmpty(password) ||
      normalizedOptions.passwordEnv ||
      normalizedOptions.passwordFile;

    if (passwordExplicitlyProvided) {
      const passwordResult = await CliUtils.getPassword(
        password,
        normalizedOptions,
        this.logService,
      );
      if (passwordResult instanceof Response) {
        return passwordResult;
      }
      return this.unlockWithPassword(passwordResult, userId);
    }

    // Non-interactive mode: skip biometrics (requires user interaction)
    if (process.env.BW_NOINTERACTION === "true") {
      const passwordResult = await CliUtils.getPassword(
        password,
        normalizedOptions,
        this.logService,
      );
      if (passwordResult instanceof Response) {
        return passwordResult;
      }
      return this.unlockWithPassword(passwordResult, userId);
    }

    // Check if biometric unlock is available
    const biometricStatus = await this.biometricsService.getBiometricsStatusForUser(userId);
    const biometricAvailable = biometricStatus === BiometricsStatus.Available;

    // If biometrics available, try it automatically with fallback to password
    if (biometricAvailable) {
      const biometricResult = await this.tryBiometricUnlock(userId);
      if (biometricResult != null) {
        return biometricResult;
      }
      // Biometric was cancelled or failed, fall back to password
      if (process.env.BW_QUIET !== "true") {
        CliUtils.writeLn("Falling back to master password...\n", false, true);
      }
    }

    // Password-based unlock
    const passwordResult = await CliUtils.getPassword(password, normalizedOptions, this.logService);

    if (passwordResult instanceof Response) {
      return passwordResult;
    }

    return this.unlockWithPassword(passwordResult, userId);
  }

  /**
   * Get the platform-specific biometric method name.
   */
  private getBiometricName(): string {
    switch (process.platform) {
      case "darwin":
        return "Touch ID";
      case "win32":
        return "Windows Hello";
      case "linux":
        return "Polkit";
      default:
        return "Biometrics";
    }
  }

  /**
   * Try to unlock with biometrics. Returns Response on success, null if cancelled/failed.
   */
  private async tryBiometricUnlock(userId: UserId): Promise<Response | null> {
    const biometricName = this.getBiometricName();
    // Write to stderr so it doesn't interfere with --raw output
    if (process.env.BW_QUIET !== "true") {
      CliUtils.writeLn(
        `Authenticate with ${biometricName} on Desktop app to continue...`,
        false,
        true,
      );
    }

    try {
      const userKey = await this.biometricsService.unlockWithBiometricsForUser(userId);

      if (userKey == null) {
        // Biometric was cancelled or failed, signal to fall back to password
        return null;
      }

      // Set the session key
      await this.setNewSessionKey();

      // Set the user key
      await this.keyService.setUserKey(userKey, userId);

      // Handle key connector conversion if needed
      if (await firstValueFrom(this.keyConnectorService.convertAccountRequired$)) {
        const convertToKeyConnectorCommand = new ConvertToKeyConnectorCommand(
          userId,
          this.keyConnectorService,
          this.environmentService,
          this.organizationApiService,
          this.logout,
          this.i18nService,
        );
        const convertResponse = await convertToKeyConnectorCommand.run();
        if (!convertResponse.success) {
          return convertResponse;
        }
      }

      // Note: Cannot run encrypted migrations without password for biometric unlock
      // This is consistent with how desktop/browser handle biometric unlock

      return this.successResponse();
    } catch (e) {
      this.logService.error("Biometric unlock failed:", e);
      // Signal to fall back to password
      return null;
    }
  }

  /**
   * Unlock the vault using master password.
   */
  private async unlockWithPassword(password: string, userId: UserId): Promise<Response> {
    await this.setNewSessionKey();

    try {
      const userKey = await this.masterPasswordUnlockService.unlockWithMasterPassword(
        password,
        userId,
      );

      await this.keyService.setUserKey(userKey, userId);
    } catch (e) {
      return Response.error(e.message);
    }

    if (await firstValueFrom(this.keyConnectorService.convertAccountRequired$)) {
      const convertToKeyConnectorCommand = new ConvertToKeyConnectorCommand(
        userId,
        this.keyConnectorService,
        this.environmentService,
        this.organizationApiService,
        this.logout,
        this.i18nService,
      );
      const convertResponse = await convertToKeyConnectorCommand.run();
      if (!convertResponse.success) {
        return convertResponse;
      }
    }

    await this.encryptedMigrator.runMigrations(userId, password);

    return this.successResponse();
  }

  private async setNewSessionKey() {
    const key = await this.cryptoFunctionService.randomBytes(64);
    process.env.BW_SESSION = Utils.fromBufferToB64(key);
  }

  private async successResponse() {
    const res = new MessageResponse(
      "Your vault is now unlocked!",
      "\n" +
        "To unlock your vault, set your session key to the `BW_SESSION` environment variable. ex:\n" +
        '$ export BW_SESSION="' +
        process.env.BW_SESSION +
        '"\n' +
        '> $env:BW_SESSION="' +
        process.env.BW_SESSION +
        '"\n\n' +
        "You can also pass the session key to any command with the `--session` option. ex:\n" +
        "$ bw list items --session " +
        process.env.BW_SESSION,
    );
    res.raw = process.env.BW_SESSION;
    return Response.success(res);
  }
}

class Options {
  passwordEnv: string;
  passwordFile: string;

  constructor(passedOptions: Record<string, any>) {
    this.passwordEnv = passedOptions?.passwordenv || passedOptions?.passwordEnv;
    this.passwordFile = passedOptions?.passwordfile || passedOptions?.passwordFile;
  }
}
