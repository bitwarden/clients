// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { combineLatest, filter, firstValueFrom, map, Observable, of, switchMap } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { NewSsoUserKeyConnectorConversion } from "@bitwarden/common/key-management/key-connector/models/new-sso-user-key-connector-conversion";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfType, KeyService, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { ApiService } from "../../../abstractions/api.service";
import { OrganizationService } from "../../../admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "../../../admin-console/enums";
import { Organization } from "../../../admin-console/models/domain/organization";
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
import { KeyConnectorService as KeyConnectorServiceAbstraction } from "../abstractions/key-connector.service";
import { KeyConnectorDomainConfirmation } from "../models/key-connector-domain-confirmation";
import { KeyConnectorUserKeyRequest } from "../models/key-connector-user-key.request";
import { SetKeyConnectorKeyRequest } from "../models/set-key-connector-key.request";

export const USES_KEY_CONNECTOR = new UserKeyDefinition<boolean | null>(
  KEY_CONNECTOR_DISK,
  "usesKeyConnector",
  {
    deserializer: (usesKeyConnector) => usesKeyConnector,
    clearOn: ["logout"],
    cleanupDelayMs: 0,
  },
);

export const NEW_SSO_USER_KEY_CONNECTOR_CONVERSION =
  new UserKeyDefinition<NewSsoUserKeyConnectorConversion | null>(
    KEY_CONNECTOR_DISK,
    "newSsoUserKeyConnectorConversion",
    {
      deserializer: (conversion) =>
        conversion == null
          ? null
          : {
              kdfConfig:
                conversion.kdfConfig.kdfType === KdfType.PBKDF2_SHA256
                  ? PBKDF2KdfConfig.fromJSON(conversion.kdfConfig)
                  : Argon2KdfConfig.fromJSON(conversion.kdfConfig),
              keyConnectorUrl: conversion.keyConnectorUrl,
              organizationId: conversion.organizationId,
            },
      clearOn: ["logout"],
      cleanupDelayMs: 0,
    },
  );

export class KeyConnectorService implements KeyConnectorServiceAbstraction {
  readonly convertAccountRequired$: Observable<boolean>;

  constructor(
    accountService: AccountService,
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
    this.convertAccountRequired$ = accountService.activeAccount$.pipe(
      filter((account) => account != null),
      switchMap((account) =>
        combineLatest([
          of(account.id),
          this.organizationService
            .organizations$(account.id)
            .pipe(filter((organizations) => organizations != null)),
          this.stateProvider
            .getUserState$(USES_KEY_CONNECTOR, account.id)
            .pipe(filter((usesKeyConnector) => usesKeyConnector != null)),
          tokenService.hasAccessToken$(account.id).pipe(filter((hasToken) => hasToken)),
        ]),
      ),
      switchMap(async ([userId, organizations, usesKeyConnector]) => {
        const loggedInUsingSso = await this.tokenService.getIsExternal(userId);
        const requiredByOrganization = this.findManagingOrganization(organizations) != null;
        const userIsNotUsingKeyConnector = !usesKeyConnector;

        return loggedInUsingSso && requiredByOrganization && userIsNotUsingKeyConnector;
      }),
    );
  }

  async setUsesKeyConnector(usesKeyConnector: boolean, userId: UserId) {
    await this.stateProvider.getUser(userId, USES_KEY_CONNECTOR).update(() => usesKeyConnector);
  }

  async getUsesKeyConnector(userId: UserId): Promise<boolean> {
    return (
      (await firstValueFrom(this.stateProvider.getUserState$(USES_KEY_CONNECTOR, userId))) ?? false
    );
  }

  async migrateUser(keyConnectorUrl: string, userId: UserId) {
    const masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
    const keyConnectorRequest = new KeyConnectorUserKeyRequest(
      Utils.fromBufferToB64(masterKey.inner().encryptionKey),
    );

    try {
      await this.apiService.postUserKeyToKeyConnector(keyConnectorUrl, keyConnectorRequest);
    } catch (e) {
      this.handleKeyConnectorError(e);
    }

    await this.apiService.postConvertToKeyConnector();

    await this.setUsesKeyConnector(true, userId);
  }

  // TODO: UserKey should be renamed to MasterKey and typed accordingly
  async setMasterKeyFromUrl(keyConnectorUrl: string, userId: UserId) {
    try {
      const masterKeyResponse = await this.apiService.getMasterKeyFromKeyConnector(keyConnectorUrl);
      const keyArr = Utils.fromB64ToArray(masterKeyResponse.key);
      const masterKey = new SymmetricCryptoKey(keyArr) as MasterKey;
      await this.masterPasswordService.setMasterKey(masterKey, userId);
    } catch (e) {
      this.handleKeyConnectorError(e);
    }
  }

  async getManagingOrganization(userId: UserId): Promise<Organization> {
    const organizations = await firstValueFrom(this.organizationService.organizations$(userId));
    return this.findManagingOrganization(organizations);
  }

  async convertNewSsoUserToKeyConnector(userId: UserId) {
    const conversion = await firstValueFrom(
      this.stateProvider.getUserState$(NEW_SSO_USER_KEY_CONNECTOR_CONVERSION, userId),
    );
    if (conversion == null) {
      throw new Error("Key Connector conversion not found");
    }

    const { kdfConfig, keyConnectorUrl, organizationId } = conversion;

    const password = await this.keyGenerationService.createKey(512);

    const masterKey = await this.keyService.makeMasterKey(
      password.keyB64,
      await this.tokenService.getEmail(),
      kdfConfig,
    );
    const keyConnectorRequest = new KeyConnectorUserKeyRequest(
      Utils.fromBufferToB64(masterKey.inner().encryptionKey),
    );
    await this.masterPasswordService.setMasterKey(masterKey, userId);

    const userKey = await this.keyService.makeUserKey(masterKey);
    await this.keyService.setUserKey(userKey[0], userId);
    await this.masterPasswordService.setMasterKeyEncryptedUserKey(userKey[1], userId);

    const [pubKey, privKey] = await this.keyService.makeKeyPair(userKey[0]);

    try {
      await this.apiService.postUserKeyToKeyConnector(keyConnectorUrl, keyConnectorRequest);
    } catch (e) {
      this.handleKeyConnectorError(e);
    }

    const keys = new KeysRequest(pubKey, privKey.encryptedString);
    const setPasswordRequest = new SetKeyConnectorKeyRequest(
      userKey[1].encryptedString,
      kdfConfig,
      organizationId,
      keys,
    );
    await this.apiService.postSetKeyConnectorKey(setPasswordRequest);

    await this.stateProvider
      .getUser(userId, NEW_SSO_USER_KEY_CONNECTOR_CONVERSION)
      .update(() => null);
  }

  async setNewSsoUserKeyConnectorConversionData(
    conversion: NewSsoUserKeyConnectorConversion,
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider
      .getUser(userId, NEW_SSO_USER_KEY_CONNECTOR_CONVERSION)
      .update(() => conversion);
  }

  requiresDomainConfirmation$(userId: UserId): Observable<KeyConnectorDomainConfirmation | null> {
    return this.stateProvider
      .getUserState$(NEW_SSO_USER_KEY_CONNECTOR_CONVERSION, userId)
      .pipe(map((data) => (data != null ? { keyConnectorUrl: data.keyConnectorUrl } : null)));
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

  private findManagingOrganization(organizations: Organization[]): Organization | undefined {
    return organizations.find(
      (o) =>
        o.keyConnectorEnabled &&
        o.type !== OrganizationUserType.Admin &&
        o.type !== OrganizationUserType.Owner &&
        !o.isProviderUser,
    );
  }
}
