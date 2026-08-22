// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { PureCrypto } from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";
import { I18nService } from "../../platform/services/i18n.service";
import { CliUtils } from "../../utils";
import { CliBiometricsService } from "../cli-biometrics-service";
import { ConvertToKeyConnectorCommand } from "../convert-to-key-connector.command";

export class UnlockCommand {
  constructor(
    private accountService: AccountService,
    private logService: ConsoleLogService,
    private keyConnectorService: KeyConnectorService,
    private environmentService: EnvironmentService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private logout: () => Promise<void>,
    private i18nService: I18nService,
    private encryptedMigrator: EncryptedMigrator,
    private unlockService: UnlockService,
    private biometricsService: CliBiometricsService,
  ) {}

  async run(password: string, cmdOptions: Record<string, any>) {
    const normalizedOptions = new Options(cmdOptions);
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (activeAccount == null) {
      return Response.error("No active account found");
    }
    const userId = activeAccount.id;

    const passwordWasProvided =
      (password != null && password !== "") ||
      normalizedOptions.passwordEnv != null ||
      normalizedOptions.passwordFile != null;
    const conversionRequired = await firstValueFrom(
      this.keyConnectorService.convertAccountRequired$,
    );

    if (
      !passwordWasProvided &&
      !conversionRequired &&
      process.env.BW_NOINTERACTION !== "true" &&
      (await this.tryBiometricUnlock(userId))
    ) {
      return this.successResponse();
    }

    const passwordResult = await CliUtils.getPassword(password, normalizedOptions, this.logService);

    if (passwordResult instanceof Response) {
      return passwordResult;
    } else {
      password = passwordResult;
    }

    await this.setNewSessionKey();

    try {
      await this.unlockService.unlockWithMasterPassword(userId, password);
    } catch (e) {
      return Response.error(e.message);
    }

    if (conversionRequired) {
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

  private async tryBiometricUnlock(userId: UserId): Promise<boolean> {
    try {
      if (
        (await this.biometricsService.getBiometricsStatusForUser(userId)) !==
        BiometricsStatus.Available
      ) {
        return false;
      }

      if (process.env.BW_QUIET !== "true" && process.env.BW_RESPONSE !== "true") {
        CliUtils.writeLn("Unlocking with biometrics...", false, true);
      }

      const userKey = await this.biometricsService.unlockWithBiometricsForUser(userId);
      if (userKey == null) {
        return false;
      }

      await this.setNewSessionKey();
      await this.unlockService.unlockWithDecryptedUserKey(userId, userKey);
      return true;
    } catch (error) {
      this.logService.info("CLI biometric unlock failed; falling back to master password", error);
      return false;
    } finally {
      this.biometricsService.disconnect();
    }
  }

  private async setNewSessionKey() {
    await SdkLoadService.Ready;
    const key = SymmetricCryptoKey.fromSdk(PureCrypto.make_aes256_cbc_hmac_key());
    process.env.BW_SESSION = key.toBase64();
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
