// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfType, KeyService, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { ApiService } from "../../../abstractions/api.service";
import { TokenService } from "../../../auth/abstractions/token.service";
import { KeysRequest } from "../../../models/request/keys.request";
import { LogService } from "../../../platform/abstractions/log.service";
import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { KEY_CONNECTOR_DISK, StateProvider, UserKeyDefinition } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { MasterKey } from "../../../types/key";
import { KeyGenerationService } from "../../crypto";
import { InternalMasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";
import { TideCloakSdkService } from "../abstractions/tidecloak-sdk.service";
import { TideCloakService as TideCloakServiceAbstraction } from "../abstractions/tidecloak.service";
import { NewSsoUserTideCloakConversion } from "../models/new-sso-user-tidecloak-conversion";
import { SetTideCloakKeyRequest } from "../models/set-tidecloak-key.request";
import { TideCloakDomainConfirmation } from "../models/tidecloak-domain-confirmation";

/** Permission tag used for master key encryption/decryption in TideCloak */
const MASTER_KEY_TAG = "master-key";

export const USES_TIDECLOAK = new UserKeyDefinition<boolean | null>(
  KEY_CONNECTOR_DISK,
  "usesTideCloak",
  {
    deserializer: (usesTideCloak) => usesTideCloak,
    clearOn: ["logout"],
    cleanupDelayMs: 0,
  },
);

export const NEW_SSO_USER_TIDECLOAK_CONVERSION =
  new UserKeyDefinition<NewSsoUserTideCloakConversion | null>(
    KEY_CONNECTOR_DISK,
    "newSsoUserTideCloakConversion",
    {
      deserializer: (conversion) =>
        conversion == null
          ? null
          : {
              kdfConfig:
                conversion.kdfConfig.kdfType === KdfType.PBKDF2_SHA256
                  ? PBKDF2KdfConfig.fromJSON(conversion.kdfConfig)
                  : Argon2KdfConfig.fromJSON(conversion.kdfConfig),
              tideCloakUrl: conversion.tideCloakUrl,
              organizationId: conversion.organizationId,
            },
      clearOn: ["logout"],
      cleanupDelayMs: 0,
    },
  );

export class TideCloakServiceImpl implements TideCloakServiceAbstraction {
  constructor(
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private keyService: KeyService,
    private apiService: ApiService,
    private tokenService: TokenService,
    private logService: LogService,
    private keyGenerationService: KeyGenerationService,
    private tideCloakSdkService: TideCloakSdkService,
    private logoutCallback: (logoutReason: LogoutReason, userId?: string) => Promise<void>,
    private stateProvider: StateProvider,
  ) {}

  async decryptMasterKeyWithTideCloak(
    encryptedMasterKey: string,
    tideCloakUrl: string,
    userId: UserId,
  ): Promise<MasterKey> {
    try {
      // Initialize SDK if not already initialized with this URL
      if (
        !this.tideCloakSdkService.isInitialized() ||
        this.tideCloakSdkService.getCurrentUrl() !== tideCloakUrl
      ) {
        await this.tideCloakSdkService.initialize(tideCloakUrl);
      }

      // Perform SMPC decryption
      const decryptedResults = await this.tideCloakSdkService.doDecrypt([
        { encrypted: encryptedMasterKey, tags: [MASTER_KEY_TAG] },
      ]);

      if (!decryptedResults || decryptedResults.length === 0) {
        throw new Error("TideCloak decryption returned no results");
      }

      // Convert decrypted bytes to MasterKey
      const masterKey = new SymmetricCryptoKey(decryptedResults[0]) as MasterKey;
      return masterKey;
    } catch (e) {
      this.logService.error("[TideCloak] Failed to decrypt master key:", e);
      throw e;
    }
  }

  async encryptMasterKeyWithTideCloak(
    masterKey: MasterKey,
    tideCloakUrl: string,
    userId: UserId,
  ): Promise<string> {
    try {
      // Initialize SDK if not already initialized with this URL
      if (
        !this.tideCloakSdkService.isInitialized() ||
        this.tideCloakSdkService.getCurrentUrl() !== tideCloakUrl
      ) {
        await this.tideCloakSdkService.initialize(tideCloakUrl);
      }

      // Get the raw key bytes
      const keyBytes = masterKey.inner().encryptionKey;

      // Perform SMPC encryption
      const encryptedResults = await this.tideCloakSdkService.doEncrypt([
        { data: keyBytes, tags: [MASTER_KEY_TAG] },
      ]);

      if (!encryptedResults || encryptedResults.length === 0) {
        throw new Error("TideCloak encryption returned no results");
      }

      return encryptedResults[0];
    } catch (e) {
      this.logService.error("[TideCloak] Failed to encrypt master key:", e);
      throw e;
    }
  }

  async getUsesTideCloak(userId: UserId): Promise<boolean> {
    return (
      (await firstValueFrom(this.stateProvider.getUserState$(USES_TIDECLOAK, userId))) ?? false
    );
  }

  async setUsesTideCloak(usesTideCloak: boolean, userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, USES_TIDECLOAK).update(() => usesTideCloak);
  }

  async convertNewSsoUserToTideCloak(userId: UserId): Promise<void> {
    const conversion = await firstValueFrom(
      this.stateProvider.getUserState$(NEW_SSO_USER_TIDECLOAK_CONVERSION, userId),
    );
    if (conversion == null) {
      throw new Error("TideCloak conversion data not found");
    }

    const { kdfConfig, tideCloakUrl, organizationId } = conversion;

    // Generate a random password for master key derivation
    // This password is never stored - only the encrypted master key is kept
    const password = await this.keyGenerationService.createKey(512);

    // Derive master key from the random password
    const masterKey = await this.keyService.makeMasterKey(
      password.keyB64,
      await this.tokenService.getEmail(),
      kdfConfig,
    );

    // Set the master key in state
    await this.masterPasswordService.setMasterKey(masterKey, userId);

    // Create user key from master key
    const userKey = await this.keyService.makeUserKey(masterKey);
    await this.keyService.setUserKey(userKey[0], userId);
    await this.masterPasswordService.setMasterKeyEncryptedUserKey(userKey[1], userId);

    // Generate key pair
    const [pubKey, privKey] = await this.keyService.makeKeyPair(userKey[0]);

    // Encrypt master key using TideCloak SMPC
    // This is the key difference from regular Key Connector - the key is encrypted
    // client-side via distributed computation, not sent to a key server
    let encryptedMasterKey: string;
    try {
      encryptedMasterKey = await this.encryptMasterKeyWithTideCloak(masterKey, tideCloakUrl, userId);
    } catch (e) {
      this.handleTideCloakError(e);
      return;
    }

    // Send the encrypted master key to vaultwarden for storage
    // Note: This uses a new endpoint specific to TideCloak
    const keys = new KeysRequest(pubKey, privKey.encryptedString);
    const setKeyRequest = new SetTideCloakKeyRequest(
      encryptedMasterKey,
      kdfConfig,
      organizationId,
      keys,
    );

    // Use the same endpoint as key connector but with TideCloak-encrypted key
    // The server stores this encrypted key in user.akey
    await this.apiService.postSetKeyConnectorKey(setKeyRequest);

    // Mark user as using TideCloak
    await this.setUsesTideCloak(true, userId);

    // Clear conversion data
    await this.stateProvider
      .getUser(userId, NEW_SSO_USER_TIDECLOAK_CONVERSION)
      .update(() => null);
  }

  async setNewSsoUserTideCloakConversionData(
    conversion: NewSsoUserTideCloakConversion,
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider
      .getUser(userId, NEW_SSO_USER_TIDECLOAK_CONVERSION)
      .update(() => conversion);
  }

  requiresDomainConfirmation$(userId: UserId): Observable<TideCloakDomainConfirmation | null> {
    return this.stateProvider.getUserState$(NEW_SSO_USER_TIDECLOAK_CONVERSION, userId).pipe(
      map((data) =>
        data != null
          ? {
              tideCloakUrl: data.tideCloakUrl,
              organizationSsoIdentifier: data.organizationId,
            }
          : null,
      ),
    );
  }

  async setMasterKeyFromTideCloak(
    tideCloakUrl: string,
    encryptedMasterKey: string,
    userId: UserId,
  ): Promise<void> {
    try {
      // Decrypt master key using TideCloak SMPC
      const masterKey = await this.decryptMasterKeyWithTideCloak(
        encryptedMasterKey,
        tideCloakUrl,
        userId,
      );

      // Set the decrypted master key
      await this.masterPasswordService.setMasterKey(masterKey, userId);
    } catch (e) {
      this.handleTideCloakError(e);
    }
  }

  private handleTideCloakError(e: unknown): void {
    this.logService.error("[TideCloak] Error:", e);
    if (this.logoutCallback != null) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.logoutCallback("keyConnectorError");
    }
    throw new Error("TideCloak error");
  }
}
