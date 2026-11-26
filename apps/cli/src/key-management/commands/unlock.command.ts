// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, timeout } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogoutService } from "@bitwarden/common/auth/logout";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { SharedUnlockPeerService } from "@bitwarden/common/key-management/shared-unlock";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { PeerLockState, PureCrypto } from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";
import { I18nService } from "../../platform/services/i18n.service";
import { CliUtils } from "../../utils";
import { CliBiometricsService } from "../cli-biometrics-service";
import { CliSharedUnlockService } from "../cli-shared-unlock.service";
import { ConvertToKeyConnectorCommand } from "../convert-to-key-connector.command";

/**
 * How long the desktop app gets to answer the shared unlock sync this CLI invocation opens with.
 * It answers on first contact, so this only has to cover the round trip; an unanswered sync means
 * no desktop peer is there, and the unlock falls back to another method.
 */
const SHARED_UNLOCK_SYNC_TIMEOUT_MS = 2_000;

export class UnlockCommand {
  constructor(
    private accountService: AccountService,
    private logService: ConsoleLogService,
    private keyConnectorService: KeyConnectorService,
    private environmentService: EnvironmentService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private logoutService: LogoutService,
    private i18nService: I18nService,
    private encryptedMigrator: EncryptedMigrator,
    private unlockService: UnlockService,
    private biometricsService: CliBiometricsService,
    private sharedUnlockPeerService: SharedUnlockPeerService,
    private cliSharedUnlockService: CliSharedUnlockService,
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

    if (!passwordWasProvided && !conversionRequired) {
      if (await this.tryUnlockFromDesktopSession(userId)) {
        return this.successResponse();
      }

      if (process.env.BW_NOINTERACTION !== "true" && (await this.tryUnlockWithDesktop(userId))) {
        return this.successResponse();
      }
    }

    const passwordResult = await CliUtils.getPassword(password, normalizedOptions, this.logService);

    if (passwordResult instanceof Response) {
      return passwordResult;
    } else {
      password = passwordResult;
    }

    await this.setNewSessionKey();

    // Started before the unlock, so the shared unlock peer announces it to the desktop app.
    await this.cliSharedUnlockService.start();

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
        this.logoutService,
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

  /**
   * Adopts the desktop app's session, when it has an unlocked one.
   *
   * Starting the peer opens with a sync that the desktop app answers on first contact: with its
   * user key when it is unlocked, with `Locked` when it is not. A desktop app that is locked, or
   * not running at all, falls through to the unlock methods used before shared unlock.
   */
  private async tryUnlockFromDesktopSession(userId: UserId): Promise<boolean> {
    // Restored unless a peer unlocks this invocation, so a shared unlock that does not happen
    // leaves the environment as it was found. `bw serve` keeps one process across requests.
    const previousSession = process.env.BW_SESSION;

    try {
      // The session key has to exist before a peer can hand this invocation a user key.
      await this.setNewSessionKey();

      // Subscribed before the peer starts, so the answer to the opening sync cannot be missed.
      const peerState = firstValueFrom(
        this.sharedUnlockPeerService
          .peerState$(userId)
          .pipe(timeout(SHARED_UNLOCK_SYNC_TIMEOUT_MS)),
      ).catch((): PeerLockState | null => null);

      if (!(await this.cliSharedUnlockService.start())) {
        this.restoreSessionKey(previousSession);
        return false;
      }

      // `Unlocked` is reported only once the peer's user key has been applied to this device.
      if ((await peerState) === "Unlocked") {
        return true;
      }
    } catch (error) {
      this.logService.info("CLI shared unlock failed; falling back to master password", error);
    }

    this.restoreSessionKey(previousSession);
    return false;
  }

  private restoreSessionKey(session: string | undefined) {
    if (session == null) {
      delete process.env.BW_SESSION;
      return;
    }

    process.env.BW_SESSION = session;
  }

  private async tryUnlockWithDesktop(userId: UserId): Promise<boolean> {
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
