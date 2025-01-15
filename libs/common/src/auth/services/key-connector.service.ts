// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { LogoutReason } from "@bitwarden/auth/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  Argon2KdfConfig,
  KdfConfig,
  PBKDF2KdfConfig,
  KeyService,
  KdfType,
} from "@bitwarden/key-management";

import { ApiService } from "../../abstractions/api.service";
import { OrganizationUserType } from "../../admin-console/enums";
import { Organization } from "../../admin-console/models/domain/organization";
import { KeysRequest } from "../../models/request/keys.request";
import { KeyGenerationService } from "../../platform/abstractions/key-generation.service";
import { LogService } from "../../platform/abstractions/log.service";
import { Utils } from "../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import {
  ActiveUserState,
  KEY_CONNECTOR_DISK,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";
import { UserId } from "../../types/guid";
import { MasterKey } from "../../types/key";
import { KeyConnectorService as KeyConnectorServiceAbstraction } from "../abstractions/key-connector.service";
import { InternalMasterPasswordServiceAbstraction } from "../abstractions/master-password.service.abstraction";
import { TokenService } from "../abstractions/token.service";
import { KeyConnectorUserKeyRequest } from "../models/request/key-connector-user-key.request";
import { SetKeyConnectorKeyRequest } from "../models/request/set-key-connector-key.request";
import { IdentityTokenResponse } from "../models/response/identity-token.response";

export const USES_KEY_CONNECTOR = new UserKeyDefinition<boolean | null>(
  KEY_CONNECTOR_DISK,
  "usesKeyConnector",
  {
    deserializer: (usesKeyConnector) => usesKeyConnector,
    clearOn: ["logout"],
  },
);

export const CONVERT_ACCOUNT_TO_KEY_CONNECTOR = new UserKeyDefinition<boolean | null>(
  KEY_CONNECTOR_DISK,
  "convertAccountToKeyConnector",
  {
    deserializer: (convertAccountToKeyConnector) => convertAccountToKeyConnector,
    clearOn: ["logout"],
  },
);

export class KeyConnectorService implements KeyConnectorServiceAbstraction {
  private usesKeyConnectorState: ActiveUserState<boolean>;
  private convertAccountToKeyConnectorState: ActiveUserState<boolean>;
  constructor(
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private keyService: KeyService,
    private apiService: ApiService,
    private tokenService: TokenService,
    private logService: LogService,
    private organizationService: OrganizationService,
    private keyGenerationService: KeyGenerationService,
    private logoutCallback: (logoutReason: LogoutReason, userId?: string) => Promise<void>,
    private stateProvider: StateProvider,
  ) {
    this.usesKeyConnectorState = this.stateProvider.getActive(USES_KEY_CONNECTOR);
    this.convertAccountToKeyConnectorState = this.stateProvider.getActive(
      CONVERT_ACCOUNT_TO_KEY_CONNECTOR,
    );
  }

  async setUsesKeyConnector(usesKeyConnector: boolean, userId: UserId) {
    await this.stateProvider.getUser(userId, USES_KEY_CONNECTOR).update(() => usesKeyConnector);
  }

  getUsesKeyConnector(userId: UserId): Promise<boolean> {
    return firstValueFrom(this.stateProvider.getUserState$(USES_KEY_CONNECTOR, userId));
  }

  async userNeedsMigration(userId: UserId) {
    const loggedInUsingSso = await this.tokenService.getIsExternal(userId);
    const requiredByOrganization = (await this.getManagingOrganization(userId)) != null;
    const userIsNotUsingKeyConnector = !(await this.getUsesKeyConnector(userId));

    return loggedInUsingSso && requiredByOrganization && userIsNotUsingKeyConnector;
  }

  async migrateUser(userId?: UserId) {
    userId ??= (await firstValueFrom(this.accountService.activeAccount$))?.id;
    const organization = await this.getManagingOrganization(userId);
    const masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
    const keyConnectorRequest = new KeyConnectorUserKeyRequest(masterKey.encKeyB64);

    try {
      await this.apiService.postUserKeyToKeyConnector(
        organization.keyConnectorUrl,
        keyConnectorRequest,
      );
    } catch (e) {
      this.handleKeyConnectorError(e);
    }

    await this.apiService.postConvertToKeyConnector();
  }

  // TODO: UserKey should be renamed to MasterKey and typed accordingly
  async setMasterKeyFromUrl(url: string, userId: UserId) {
    try {
      const masterKeyResponse = await this.apiService.getMasterKeyFromKeyConnector(url);
      const keyArr = Utils.fromB64ToArray(masterKeyResponse.key);
      const masterKey = new SymmetricCryptoKey(keyArr) as MasterKey;
      await this.masterPasswordService.setMasterKey(masterKey, userId);
    } catch (e) {
      this.handleKeyConnectorError(e);
    }
  }

  async getManagingOrganization(userId?: UserId): Promise<Organization> {
    const orgs = await firstValueFrom(this.organizationService.organizations$(userId));
    return orgs.find(
      (o) =>
        o.keyConnectorEnabled &&
        o.type !== OrganizationUserType.Admin &&
        o.type !== OrganizationUserType.Owner &&
        !o.isProviderUser,
    );
  }

  async convertNewSsoUserToKeyConnector(
    tokenResponse: IdentityTokenResponse,
    orgId: string,
    userId: UserId,
  ) {
    // TODO: Remove after tokenResponse.keyConnectorUrl is deprecated in 2023.10 release (https://bitwarden.atlassian.net/browse/PM-3537)
    const {
      kdf,
      kdfIterations,
      kdfMemory,
      kdfParallelism,
      keyConnectorUrl: legacyKeyConnectorUrl,
      userDecryptionOptions,
    } = tokenResponse;
    const password = await this.keyGenerationService.createKey(512);
    const kdfConfig: KdfConfig =
      kdf === KdfType.PBKDF2_SHA256
        ? new PBKDF2KdfConfig(kdfIterations)
        : new Argon2KdfConfig(kdfIterations, kdfMemory, kdfParallelism);

    const masterKey = await this.keyService.makeMasterKey(
      password.keyB64,
      await this.tokenService.getEmail(),
      kdfConfig,
    );
    const keyConnectorRequest = new KeyConnectorUserKeyRequest(masterKey.encKeyB64);
    await this.masterPasswordService.setMasterKey(masterKey, userId);

    const userKey = await this.keyService.makeUserKey(masterKey);
    await this.keyService.setUserKey(userKey[0], userId);
    await this.keyService.setMasterKeyEncryptedUserKey(userKey[1].encryptedString, userId);

    const [pubKey, privKey] = await this.keyService.makeKeyPair(userKey[0]);

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
      kdfConfig,
      orgId,
      keys,
    );
    await this.apiService.postSetKeyConnectorKey(setPasswordRequest);
  }

  async setConvertAccountRequired(status: boolean, userId?: UserId) {
    await this.stateProvider.setUserState(CONVERT_ACCOUNT_TO_KEY_CONNECTOR, status, userId);
  }

  getConvertAccountRequired(): Promise<boolean> {
    return firstValueFrom(this.convertAccountToKeyConnectorState.state$);
  }

  async removeConvertAccountRequired(userId?: UserId) {
    await this.setConvertAccountRequired(null, userId);
  }

  private handleKeyConnectorError(e: any) {
    this.logService.error(e);
    if (this.logoutCallback != null) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.logoutCallback("keyConnectorError");
    }
    throw new Error("Key Connector error");
  }
}
