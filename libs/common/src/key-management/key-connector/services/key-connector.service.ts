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
import {
  Argon2KdfConfig,
  KdfConfig,
  KdfType,
  KeyService,
  PBKDF2KdfConfig,
} from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { ApiService } from "../../../abstractions/api.service";
import { OrganizationService } from "../../../admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "../../../admin-console/enums";
import { Organization } from "../../../admin-console/models/domain/organization";
import { TokenService } from "../../../auth/abstractions/token.service";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { KeysRequest } from "../../../models/request/keys.request";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { RegisterSdkService } from "../../../platform/abstractions/sdk/register-sdk.service";
import { asUuid } from "../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { KEY_CONNECTOR_DISK, StateProvider, UserKeyDefinition } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { MasterKey, UserKey } from "../../../types/key";
import { AccountCryptographicStateService } from "../../account-cryptography/account-cryptographic-state.service";
import { KeyGenerationService } from "../../crypto";
import { EncString } from "../../crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";
import { SecurityStateService } from "../../security-state/abstractions/security-state.service";
import { SignedPublicKey, SignedSecurityState, WrappedSigningKey } from "../../types";
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
    private configService: ConfigService,
    private registerSdkService: RegisterSdkService,
    private securityStateService: SecurityStateService,
    private accountCryptographicStateService: AccountCryptographicStateService,
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

    const { kdfConfig, keyConnectorUrl, organizationId: ssoOrganizationIdentifier } = conversion;

    if (
      await firstValueFrom(
        this.configService.getFeatureFlag$(
          FeatureFlag.EnableAccountEncryptionV2KeyConnectorRegistration,
        ),
      )
    ) {
      await this.convertNewSsoUserToKeyConnectorV2(
        userId,
        keyConnectorUrl,
        ssoOrganizationIdentifier,
      );
    } else {
      await this.convertNewSsoUserToKeyConnectorV1(
        userId,
        kdfConfig,
        keyConnectorUrl,
        ssoOrganizationIdentifier,
      );
    }

    await this.stateProvider
      .getUser(userId, NEW_SSO_USER_KEY_CONNECTOR_CONVERSION)
      .update(() => null);
  }

  async convertNewSsoUserToKeyConnectorV2(
    userId: UserId,
    keyConnectorUrl: string,
    ssoOrganizationIdentifier: string,
  ) {
    const result = await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        map((sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();

          return ref.value
            .auth()
            .registration()
            .post_keys_for_key_connector_registration(
              keyConnectorUrl,
              ssoOrganizationIdentifier,
              asUuid(userId),
            );
        }),
      ),
    );

    if (!("V2" in result.account_cryptographic_state)) {
      const version = Object.keys(result.account_cryptographic_state);
      throw new Error(`Unexpected account cryptographic state version ${version}`);
    }

    await this.masterPasswordService.setMasterKey(
      SymmetricCryptoKey.fromString(result.key_connector_key) as MasterKey,
      userId,
    );
    await this.keyService.setUserKey(
      SymmetricCryptoKey.fromString(result.user_key) as UserKey,
      userId,
    );
    await this.masterPasswordService.setMasterKeyEncryptedUserKey(
      new EncString(result.key_connector_key_wrapped_user_key),
      userId,
    );

    await this.accountCryptographicStateService.setAccountCryptographicState(
      result.account_cryptographic_state,
      userId,
    );
    // Legacy states
    await this.keyService.setPrivateKey(result.account_cryptographic_state.V2.private_key, userId);
    await this.keyService.setUserSigningKey(
      result.account_cryptographic_state.V2.signing_key as WrappedSigningKey,
      userId,
    );
    await this.securityStateService.setAccountSecurityState(
      result.account_cryptographic_state.V2.security_state as SignedSecurityState,
      userId,
    );
    if (result.account_cryptographic_state.V2.signed_public_key != null) {
      await this.keyService.setSignedPublicKey(
        result.account_cryptographic_state.V2.signed_public_key as SignedPublicKey,
        userId,
      );
    }
  }

  async convertNewSsoUserToKeyConnectorV1(
    userId: UserId,
    kdfConfig: KdfConfig,
    keyConnectorUrl: string,
    ssoOrganizationIdentifier: string,
  ) {
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
      ssoOrganizationIdentifier,
      keys,
    );
    await this.apiService.postSetKeyConnectorKey(setPasswordRequest);
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
    return this.stateProvider.getUserState$(NEW_SSO_USER_KEY_CONNECTOR_CONVERSION, userId).pipe(
      map((data) =>
        data != null
          ? {
              keyConnectorUrl: data.keyConnectorUrl,
              organizationSsoIdentifier: data.organizationId,
            }
          : null,
      ),
    );
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
