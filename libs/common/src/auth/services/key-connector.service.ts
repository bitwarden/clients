import { ApiService } from "../../abstractions/api.service";
import { OrganizationService } from "../../admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "../../admin-console/enums";
import { KeysRequest } from "../../models/request/keys.request";
import { CryptoFunctionService } from "../../platform/abstractions/crypto-function.service";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { LogService } from "../../platform/abstractions/log.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Utils } from "../../platform/misc/utils";
import { MasterKey, SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { KeyConnectorService as KeyConnectorServiceAbstraction } from "../abstractions/key-connector.service";
import { TokenService } from "../abstractions/token.service";
import { KdfConfig } from "../models/domain/kdf-config";
import { KeyConnectorUserKeyRequest } from "../models/request/key-connector-user-key.request";
import { SetKeyConnectorKeyRequest } from "../models/request/set-key-connector-key.request";
import { IdentityTokenResponse } from "../models/response/identity-token.response";

export class KeyConnectorService implements KeyConnectorServiceAbstraction {
  constructor(
    private stateService: StateService,
    private cryptoService: CryptoService,
    private apiService: ApiService,
    private tokenService: TokenService,
    private logService: LogService,
    private organizationService: OrganizationService,
    private cryptoFunctionService: CryptoFunctionService,
    private logoutCallback: (expired: boolean, userId?: string) => Promise<void>
  ) {}

  setUsesKeyConnector(usesKeyConnector: boolean) {
    return this.stateService.setUsesKeyConnector(usesKeyConnector);
  }

  async getUsesKeyConnector(): Promise<boolean> {
    return await this.stateService.getUsesKeyConnector();
  }

  async userNeedsMigration() {
    const loggedInUsingSso = await this.tokenService.getIsExternal();
    const requiredByOrganization = (await this.getManagingOrganization()) != null;
    const userIsNotUsingKeyConnector = !(await this.getUsesKeyConnector());

    return loggedInUsingSso && requiredByOrganization && userIsNotUsingKeyConnector;
  }

  async migrateUser() {
    const organization = await this.getManagingOrganization();
    const masterKey = await this.cryptoService.getMasterKey();
    const keyConnectorRequest = new KeyConnectorUserKeyRequest(masterKey.encKeyB64);

    try {
      await this.apiService.postUserKeyToKeyConnector(
        organization.keyConnectorUrl,
        keyConnectorRequest
      );
    } catch (e) {
      this.handleKeyConnectorError(e);
    }

    await this.apiService.postConvertToKeyConnector();
  }

  // TODO: UserKey should be renamed to MasterKey and typed accordingly
  async setMasterKeyFromUrl(url: string) {
    try {
      const masterKeyResponse = await this.apiService.getMasterKeyFromKeyConnector(url);
      const keyArr = Utils.fromB64ToArray(masterKeyResponse.key);
      const masterKey = new SymmetricCryptoKey(keyArr) as MasterKey;
      await this.cryptoService.setMasterKey(masterKey);
    } catch (e) {
      this.handleKeyConnectorError(e);
    }
  }

  async getManagingOrganization() {
    const orgs = await this.organizationService.getAll();
    return orgs.find(
      (o) =>
        o.keyConnectorEnabled &&
        o.type !== OrganizationUserType.Admin &&
        o.type !== OrganizationUserType.Owner &&
        !o.isProviderUser
    );
  }

  async convertNewSsoUserToKeyConnector(tokenResponse: IdentityTokenResponse, orgId: string) {
    // TODO: Remove after tokenResponse.keyConnectorUrl is deprecated in 2023.10 release (https://bitwarden.atlassian.net/browse/PM-3537)
    const {
      kdf,
      kdfIterations,
      kdfMemory,
      kdfParallelism,
      keyConnectorUrl: legacyKeyConnectorUrl,
      userDecryptionOptions,
    } = tokenResponse;
    const password = await this.cryptoFunctionService.aesGenerateKey(512);
    const kdfConfig = new KdfConfig(kdfIterations, kdfMemory, kdfParallelism);

    const masterKey = await this.cryptoService.makeMasterKey(
      Utils.fromBufferToB64(password),
      await this.tokenService.getEmail(),
      kdf,
      kdfConfig
    );
    const keyConnectorRequest = new KeyConnectorUserKeyRequest(masterKey.encKeyB64);
    await this.cryptoService.setMasterKey(masterKey);

    const userKey = await this.cryptoService.makeUserKey(masterKey);
    await this.cryptoService.setUserKey(userKey[0]);
    await this.cryptoService.setMasterKeyEncryptedUserKey(userKey[1].encryptedString);

    const [pubKey, privKey] = await this.cryptoService.makeKeyPair();

    try {
      const keyConnectorUrl =
        legacyKeyConnectorUrl ?? userDecryptionOptions?.keyConnectorOption?.keyConnectorUrl;
      await this.apiService.postUserKeyToKeyConnector(keyConnectorUrl, keyConnectorRequest);
    } catch (e) {
      this.handleKeyConnectorError(e);
    }

    const keys = new KeysRequest(pubKey, privKey.encryptedString);
    const setPasswordRequest = new SetKeyConnectorKeyRequest(
      userKey[1].encryptedString,
      kdf,
      kdfConfig,
      orgId,
      keys
    );
    await this.apiService.postSetKeyConnectorKey(setPasswordRequest);
  }

  async setConvertAccountRequired(status: boolean) {
    await this.stateService.setConvertAccountToKeyConnector(status);
  }

  async getConvertAccountRequired(): Promise<boolean> {
    return await this.stateService.getConvertAccountToKeyConnector();
  }

  async removeConvertAccountRequired() {
    await this.stateService.setConvertAccountToKeyConnector(null);
  }

  async clear() {
    await this.removeConvertAccountRequired();
  }

  private handleKeyConnectorError(e: any) {
    this.logService.error(e);
    if (this.logoutCallback != null) {
      this.logoutCallback(false);
    }
    throw new Error("Key Connector error");
  }
}
