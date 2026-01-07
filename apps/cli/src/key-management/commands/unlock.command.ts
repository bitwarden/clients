// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as inquirer from "inquirer";
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

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";
import { I18nService } from "../../platform/services/i18n.service";
import { CliUtils } from "../../utils";
import { CliBiometricsService } from "../cli-biometrics-service";
import { ConvertToKeyConnectorCommand } from "../convert-to-key-connector.command";

// Unlock method choices for interactive prompt
const UNLOCK_METHOD_BIOMETRIC = "biometric";
const UNLOCK_METHOD_PASSWORD = "password";

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

    // Check if biometric unlock was explicitly requested
    if (normalizedOptions.biometric) {
      return this.unlockWithBiometrics(userId);
    }

    // Check if biometric unlock is available for interactive selection
    const biometricStatus = await this.biometricsService.getBiometricsStatusForUser(userId);
    const biometricAvailable = biometricStatus === BiometricsStatus.Available;

    // If no password provided and interactive mode, offer unlock method choice
    if (
      Utils.isNullOrEmpty(password) &&
      !normalizedOptions.passwordEnv &&
      !normalizedOptions.passwordFile &&
      process.env.BW_NOINTERACTION !== "true"
    ) {
      if (biometricAvailable) {
        const unlockMethod = await this.promptUnlockMethod();
        if (unlockMethod === UNLOCK_METHOD_BIOMETRIC) {
          return this.unlockWithBiometrics(userId);
        }
      }
    }

    // Standard password-based unlock
    const passwordResult = await CliUtils.getPassword(password, normalizedOptions, this.logService);

    if (passwordResult instanceof Response) {
      return passwordResult;
    } else {
      password = passwordResult;
    }

    return this.unlockWithPassword(password, userId);
  }

  /**
   * Prompt user to choose unlock method when biometrics is available.
   */
  private async promptUnlockMethod(): Promise<string> {
    const biometricName = this.getBiometricName();

    const answer: inquirer.Answers = await inquirer.createPromptModule({
      output: process.stderr,
    })({
      type: "list",
      name: "unlockMethod",
      message: "How would you like to unlock?",
      choices: [
        {
          name: `Use ${biometricName} (via Desktop app)`,
          value: UNLOCK_METHOD_BIOMETRIC,
        },
        {
          name: "Use master password",
          value: UNLOCK_METHOD_PASSWORD,
        },
      ],
    });

    return answer.unlockMethod;
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
      default:
        return "Biometrics";
    }
  }

  /**
   * Unlock the vault using biometrics via the Desktop app.
   */
  private async unlockWithBiometrics(userId: string): Promise<Response> {
    // Check biometric status
    const status = await this.biometricsService.getBiometricsStatusForUser(userId as any);

    if (status !== BiometricsStatus.Available) {
      const statusDescription = this.biometricsService.getBiometricsStatusDescription(status);
      return Response.error(`Biometric unlock is not available: ${statusDescription}`);
    }

    const biometricName = this.getBiometricName();
    // Write to stderr so it doesn't interfere with --raw output
    CliUtils.writeLn(`\n👆 ${biometricName} prompt on Desktop app...\n`, false, true);

    try {
      const userKey = await this.biometricsService.unlockWithBiometricsForUser(userId as any);

      if (userKey == null) {
        return Response.error(
          `${biometricName} unlock was cancelled or failed. Try again or use master password.`,
        );
      }

      // Set the session key
      await this.setNewSessionKey();

      // Set the user key
      await this.keyService.setUserKey(userKey, userId as any);

      // Handle key connector conversion if needed
      if (await firstValueFrom(this.keyConnectorService.convertAccountRequired$)) {
        const convertToKeyConnectorCommand = new ConvertToKeyConnectorCommand(
          userId as any,
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
      return Response.error(
        `${biometricName} unlock failed: ${e.message || "Unknown error"}. Try again or use master password.`,
      );
    }
  }

  /**
   * Unlock the vault using master password.
   */
  private async unlockWithPassword(password: string, userId: string): Promise<Response> {
    await this.setNewSessionKey();

    try {
      const userKey = await this.masterPasswordUnlockService.unlockWithMasterPassword(
        password,
        userId as any,
      );

      await this.keyService.setUserKey(userKey, userId as any);
    } catch (e) {
      return Response.error(e.message);
    }

    if (await firstValueFrom(this.keyConnectorService.convertAccountRequired$)) {
      const convertToKeyConnectorCommand = new ConvertToKeyConnectorCommand(
        userId as any,
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

    await this.encryptedMigrator.runMigrations(userId as any, password);

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
  biometric: boolean;

  constructor(passedOptions: Record<string, any>) {
    this.passwordEnv = passedOptions?.passwordenv || passedOptions?.passwordEnv;
    this.passwordFile = passedOptions?.passwordfile || passedOptions?.passwordFile;
    this.biometric = passedOptions?.biometric || false;
  }
}
