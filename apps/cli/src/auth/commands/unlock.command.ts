import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { HashPurpose } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { ConvertToKeyConnectorCommand } from "../../commands/convert-to-key-connector.command";
import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";
import { CliUtils } from "../../utils";

export class UnlockCommand {
  constructor(
    private cryptoService: CryptoService,
    private stateService: StateService,
    private cryptoFunctionService: CryptoFunctionService,
    private apiService: ApiService,
    private logService: ConsoleLogService,
    private keyConnectorService: KeyConnectorService,
    private environmentService: EnvironmentService,
    private syncService: SyncService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private logout: () => Promise<void>
  ) {}

  async run(password: string, cmdOptions: Record<string, any>) {
    const normalizedOptions = new Options(cmdOptions);
    const passwordResult = await CliUtils.getPassword(password, normalizedOptions, this.logService);

    if (passwordResult instanceof Response) {
      return passwordResult;
    } else {
      password = passwordResult;
    }

    await this.setNewSessionKey();
    const email = await this.stateService.getEmail();
    const kdf = await this.stateService.getKdfType();
    const kdfConfig = await this.stateService.getKdfConfig();
    const masterKey = await this.cryptoService.makeMasterKey(password, email, kdf, kdfConfig);
    const storedKeyHash = await this.cryptoService.getMasterKeyHash();

    let passwordValid = false;
    if (masterKey != null) {
      if (storedKeyHash != null) {
        passwordValid = await this.cryptoService.compareAndUpdateKeyHash(password, masterKey);
      } else {
        const serverKeyHash = await this.cryptoService.hashMasterKey(
          password,
          masterKey,
          HashPurpose.ServerAuthorization
        );
        const request = new SecretVerificationRequest();
        request.masterPasswordHash = serverKeyHash;
        try {
          await this.apiService.postAccountVerifyPassword(request);
          passwordValid = true;
          const localKeyHash = await this.cryptoService.hashMasterKey(
            password,
            masterKey,
            HashPurpose.LocalAuthorization
          );
          await this.cryptoService.setMasterKeyHash(localKeyHash);
        } catch {
          // Ignore
        }
      }
    }

    if (passwordValid) {
      await this.cryptoService.setMasterKey(masterKey);
      const userKey = await this.cryptoService.decryptUserKeyWithMasterKey(masterKey);
      await this.cryptoService.setUserKey(userKey);

      if (await this.keyConnectorService.getConvertAccountRequired()) {
        const convertToKeyConnectorCommand = new ConvertToKeyConnectorCommand(
          this.keyConnectorService,
          this.environmentService,
          this.syncService,
          this.organizationApiService,
          this.logout
        );
        const convertResponse = await convertToKeyConnectorCommand.run();
        if (!convertResponse.success) {
          return convertResponse;
        }
      }

      return this.successResponse();
    } else {
      return Response.error("Invalid master password.");
    }
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
        process.env.BW_SESSION
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
