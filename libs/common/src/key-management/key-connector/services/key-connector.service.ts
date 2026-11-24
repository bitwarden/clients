// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { combineLatest, filter, firstValueFrom, map, Observable, of, switchMap } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
// eslint-disable-next-line no-restricted-imports
import {
  Argon2KdfConfig,
  KdfConfig,
  KdfType,
  LegacyCompatKeyService,
  PBKDF2KdfConfig,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { PureCrypto } from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";

import { ApiService } from "../../../abstractions/api.service";
import { OrganizationService } from "../../../admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "../../../admin-console/enums";
import { Organization } from "../../../admin-console/models/domain/organization";
import { AccountService } from "../../../auth/abstractions/account.service";
import { TokenService } from "../../../auth/abstractions/token.service";
import { LogoutReason } from "../../../auth/logout";
import {
  SsoJitProvisionFinishApiService,
  SsoJitProvisionFinishService,
  SsoJitProvisionFinishSetKeyConnectorKeyRequest,
} from "../../../auth/sso-jit-provision-finish";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { KeysRequest } from "../../../models/request/keys.request";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { SdkLoadService } from "../../../platform/abstractions/sdk/sdk-load.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../platform/misc/utils";
import { KEY_CONNECTOR_DISK, StateProvider, UserKeyDefinition } from "../../../platform/state";
import { OrganizationId, UserId } from "../../../types/guid";
import { AccountCryptographicStateService } from "../../account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";
import { withPasswordManagerSdk } from "../../utils";
import { KeyConnectorService as KeyConnectorServiceAbstraction } from "../abstractions/key-connector.service";
import { KeyConnectorDomainConfirmation } from "../models/key-connector-domain-confirmation";
import { KeyConnectorUserKeyRequest } from "../models/key-connector-user-key.request";
import { NewSsoUserKeyConnectorConversion } from "../models/new-sso-user-key-connector-conversion";
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
    private legacyCompatKeyService: LegacyCompatKeyService,
    private apiService: ApiService,
    private tokenService: TokenService,
    private logService: LogService,
    private organizationService: OrganizationService,
    private logoutCallback: (logoutReason: LogoutReason, userId?: string) => Promise<void>,
    private stateProvider: StateProvider,
    private configService: ConfigService,
    private ssoJitProvisionFinishService: SsoJitProvisionFinishService,
    private ssoJitProvisionFinishApiService: SsoJitProvisionFinishApiService,
    private accountCryptographicStateService: AccountCryptographicStateService,
    private sdkService: SdkService,
    private userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    private unlockService: UnlockService,
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
    try {
      await withPasswordManagerSdk(userId, this.sdkService, async (sdk) => {
        await sdk.user_crypto_management().migrate_to_key_connector(keyConnectorUrl);
      });
    } catch (e) {
      this.handleKeyConnectorError(e);
    }

    await this.setUsesKeyConnector(true, userId);

    // Clear master password unlock from state
    // TODO(https://bitwarden.atlassian.net/browse/PM-43754): move to sdk's migrate_to_key_connector
    await this.masterPasswordService.clearMasterPasswordUnlockData(userId);

    const userDecryptionOptions = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
    );
    userDecryptionOptions.hasMasterPassword = false;
    userDecryptionOptions.keyConnectorOption = {
      keyConnectorUrl,
    };
    await this.userDecryptionOptionsService.setUserDecryptionOptionsById(
      userId,
      userDecryptionOptions,
    );
  }

  async getManagingOrganization(userId: UserId): Promise<Organization> {
    const organizations = await firstValueFrom(this.organizationService.organizations$(userId));
    return this.findManagingOrganization(organizations);
  }

  async convertNewSsoUserToKeyConnector(userId: UserId, orgId: OrganizationId): Promise<boolean> {
    const conversion = await firstValueFrom(
      this.stateProvider.getUserState$(NEW_SSO_USER_KEY_CONNECTOR_CONVERSION, userId),
    );
    if (conversion == null) {
      throw new Error("Key Connector conversion not found");
    }

    const { kdfConfig, keyConnectorUrl, organizationId: ssoOrganizationIdentifier } = conversion;

    let organizationInviteAccepted: boolean;
    if (
      await firstValueFrom(
        this.configService.getFeatureFlag$(
          FeatureFlag.EnableAccountEncryptionV2KeyConnectorRegistration,
        ),
      )
    ) {
      organizationInviteAccepted = await this.convertNewSsoUserToKeyConnectorV2(
        userId,
        orgId,
        keyConnectorUrl,
        ssoOrganizationIdentifier,
      );
    } else {
      organizationInviteAccepted = await this.convertNewSsoUserToKeyConnectorV1(
        userId,
        orgId,
        kdfConfig,
        keyConnectorUrl,
        ssoOrganizationIdentifier,
      );
    }

    await this.stateProvider
      .getUser(userId, NEW_SSO_USER_KEY_CONNECTOR_CONVERSION)
      .update(() => null);

    return organizationInviteAccepted;
  }

  async convertNewSsoUserToKeyConnectorV2(
    userId: UserId,
    orgId: OrganizationId,
    keyConnectorUrl: string,
    ssoOrganizationIdentifier: string,
  ): Promise<boolean> {
    const { registration: result, organizationInviteAccepted } =
      await this.ssoJitProvisionFinishService.finishKeyConnector({
        userId,
        orgId,
        orgSsoIdentifier: ssoOrganizationIdentifier,
        keyConnectorUrl,
      });

    if (!("V2" in result.account_cryptographic_state)) {
      const version = Object.keys(result.account_cryptographic_state);
      throw new Error(`Unexpected account cryptographic state version ${version}`);
    }

    // Note: When SDK state management matures, the state writes and the unlock below should all be
    // moved into SsoJitProvisionFinishService.finishKeyConnector
    await this.accountCryptographicStateService.setAccountCryptographicState(
      result.account_cryptographic_state,
      userId,
    );

    // Unlocking initializes the SDK from state, so it has to run after the account cryptographic
    // state above has been persisted.
    await this.unlockService.unlockWithDecryptedUserKey(
      userId,
      SymmetricCryptoKey.fromString(result.user_key),
    );

    return organizationInviteAccepted;
  }

  // TODO: Remove with https://bitwarden.atlassian.net/browse/PM-27328 (V1 Key Connector registration).
  async convertNewSsoUserToKeyConnectorV1(
    userId: UserId,
    orgId: OrganizationId,
    kdfConfig: KdfConfig,
    keyConnectorUrl: string,
    ssoOrganizationIdentifier: string,
  ): Promise<boolean> {
    const organizationInviteAccepted =
      await this.ssoJitProvisionFinishService.shouldAcceptOrganizationInvite(orgId);

    await SdkLoadService.Ready;
    const password = SymmetricCryptoKey.fromSdk(PureCrypto.make_aes256_cbc_hmac_key());

    const masterKey = await this.legacyCompatKeyService.makeMasterKey(
      password.keyB64,
      this.masterPasswordService.emailToSalt(await this.tokenService.getEmail()),
      kdfConfig,
    );
    const keyConnectorRequest = new KeyConnectorUserKeyRequest(
      Utils.fromBufferToB64(masterKey.inner().encryptionKey),
    );
    const userKey = await this.legacyCompatKeyService.makeUserKey(masterKey);

    const [pubKey, privKey] = await this.legacyCompatKeyService.makeKeyPair(userKey[0]);

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
    // Same endpoint choice as the SDK makes for V2. The legacy endpoint always accepts the invite.
    // TODO: Remove the legacy endpoint when the pm-34429-invite-link-auto-confirm flag is removed
    // with https://bitwarden.atlassian.net/browse/PM-40052
    if (await this.configService.getFeatureFlag(FeatureFlag.InviteLinkAutoConfirm)) {
      await this.ssoJitProvisionFinishApiService.postKeyConnector(
        new SsoJitProvisionFinishSetKeyConnectorKeyRequest(
          setPasswordRequest,
          organizationInviteAccepted,
        ),
      );
    } else {
      await this.apiService.postSetKeyConnectorKey(setPasswordRequest);
    }

    // The key pair generated above is only known to the server until it is persisted here.
    // Unlocking initializes the SDK from state, so it has to run after that.
    await this.accountCryptographicStateService.setAccountCryptographicState(
      {
        V1: {
          private_key: privKey.encryptedString,
        },
      },
      userId,
    );
    await this.unlockService.unlockWithDecryptedUserKey(userId, userKey[0]);

    return organizationInviteAccepted;
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
