// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";

import {
  CollectionService,
  CollectionData,
  CollectionDetailsResponse,
} from "@bitwarden/admin-console/common";
import { KeyService } from "@bitwarden/key-management";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { UserDecryptionOptionsServiceAbstraction } from "../../../../auth/src/common/abstractions";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "../../../../auth/src/common/types";
import { ApiService } from "../../abstractions/api.service";
import { InternalOrganizationServiceAbstraction } from "../../admin-console/abstractions/organization/organization.service.abstraction";
import { InternalPolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "../../admin-console/abstractions/provider.service";
import { OrganizationUserType } from "../../admin-console/enums";
import { OrganizationData } from "../../admin-console/models/data/organization.data";
import { PolicyData } from "../../admin-console/models/data/policy.data";
import { ProviderData } from "../../admin-console/models/data/provider.data";
import { PolicyResponse } from "../../admin-console/models/response/policy.response";
import { AccountService } from "../../auth/abstractions/account.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AvatarService } from "../../auth/abstractions/avatar.service";
import { KeyConnectorService } from "../../auth/abstractions/key-connector.service";
import { InternalMasterPasswordServiceAbstraction } from "../../auth/abstractions/master-password.service.abstraction";
import { TokenService } from "../../auth/abstractions/token.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { ForceSetPasswordReason } from "../../auth/models/domain/force-set-password-reason";
import { DomainSettingsService } from "../../autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "../../billing/abstractions";
import { DomainsResponse } from "../../models/response/domains.response";
import { ProfileResponse } from "../../models/response/profile.response";
import { SendData } from "../../tools/send/models/data/send.data";
import { SendResponse } from "../../tools/send/models/response/send.response";
import { SendApiService } from "../../tools/send/services/send-api.service.abstraction";
import { InternalSendService } from "../../tools/send/services/send.service.abstraction";
import { UserId } from "../../types/guid";
import { CipherService } from "../../vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "../../vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "../../vault/abstractions/folder/folder.service.abstraction";
import { CipherData } from "../../vault/models/data/cipher.data";
import { FolderData } from "../../vault/models/data/folder.data";
import { CipherResponse } from "../../vault/models/response/cipher.response";
import { FolderResponse } from "../../vault/models/response/folder.response";
import { LogService } from "../abstractions/log.service";
import { StateService } from "../abstractions/state.service";
import { MessageSender } from "../messaging";
import { sequentialize } from "../misc/sequentialize";
import { StateProvider } from "../state";

import { CoreSyncService } from "./core-sync.service";

export class DefaultSyncService extends CoreSyncService {
  syncInProgress = false;

  constructor(
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    accountService: AccountService,
    apiService: ApiService,
    private domainSettingsService: DomainSettingsService,
    folderService: InternalFolderService,
    cipherService: CipherService,
    private keyService: KeyService,
    collectionService: CollectionService,
    messageSender: MessageSender,
    private policyService: InternalPolicyService,
    sendService: InternalSendService,
    logService: LogService,
    private keyConnectorService: KeyConnectorService,
    stateService: StateService,
    private providerService: ProviderService,
    folderApiService: FolderApiServiceAbstraction,
    private organizationService: InternalOrganizationServiceAbstraction,
    sendApiService: SendApiService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private avatarService: AvatarService,
    private logoutCallback: (logoutReason: LogoutReason, userId?: UserId) => Promise<void>,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private tokenService: TokenService,
    authService: AuthService,
    stateProvider: StateProvider,
  ) {
    super(
      stateService,
      folderService,
      folderApiService,
      messageSender,
      logService,
      cipherService,
      collectionService,
      apiService,
      accountService,
      authService,
      sendService,
      sendApiService,
      stateProvider,
    );
  }

  @sequentialize(() => "fullSync")
  override async fullSync(forceSync: boolean, allowThrowOnError = false): Promise<boolean> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
    this.syncStarted();
    const authStatus = await firstValueFrom(this.authService.authStatusFor$(userId));
    if (authStatus === AuthenticationStatus.LoggedOut) {
      return this.syncCompleted(false);
    }

    const now = new Date();
    let needsSync = false;
    try {
      needsSync = await this.needsSyncing(forceSync);
    } catch (e) {
      if (allowThrowOnError) {
        this.syncCompleted(false);
        throw e;
      }
    }

    if (!needsSync) {
      await this.setLastSync(now, userId);
      return this.syncCompleted(false);
    }

    try {
      await this.apiService.refreshIdentityToken();
      const response = await this.apiService.getSync();

      await this.syncProfile(response.profile);
      await this.syncFolders(response.folders, response.profile.id);
      await this.syncCollections(response.collections, response.profile.id);
      await this.syncCiphers(response.ciphers, response.profile.id);
      await this.syncSends(response.sends, response.profile.id);
      await this.syncSettings(response.domains, response.profile.id);
      await this.syncPolicies(response.policies, response.profile.id);

      await this.setLastSync(now, userId);
      return this.syncCompleted(true);
    } catch (e) {
      if (allowThrowOnError) {
        this.syncCompleted(false);
        throw e;
      } else {
        return this.syncCompleted(false);
      }
    }
  }

  private async needsSyncing(forceSync: boolean) {
    if (forceSync) {
      return true;
    }

    const lastSync = await this.getLastSync();
    if (lastSync == null || lastSync.getTime() === 0) {
      return true;
    }

    const response = await this.apiService.getAccountRevisionDate();
    if (response < 0 && this.logoutCallback) {
      // Account was deleted, log out now
      await this.logoutCallback("accountDeleted");
    }

    if (new Date(response) <= lastSync) {
      return false;
    }
    return true;
  }

  private async syncProfile(response: ProfileResponse) {
    const stamp = await this.tokenService.getSecurityStamp(response.id);
    if (stamp != null && stamp !== response.securityStamp) {
      if (this.logoutCallback != null) {
        await this.logoutCallback("invalidSecurityStamp");
      }

      throw new Error("Stamp has changed");
    }

    await this.keyService.setMasterKeyEncryptedUserKey(response.key, response.id);
    await this.keyService.setPrivateKey(response.privateKey, response.id);
    await this.keyService.setProviderKeys(response.providers, response.id);
    await this.keyService.setOrgKeys(
      response.organizations,
      response.providerOrganizations,
      response.id,
    );
    await this.avatarService.setSyncAvatarColor(response.id, response.avatarColor);
    await this.tokenService.setSecurityStamp(response.securityStamp, response.id);
    await this.accountService.setAccountEmailVerified(response.id, response.emailVerified);
    await this.accountService.setAccountVerifyNewDeviceLogin(response.id, response.verifyDevices);

    await this.billingAccountProfileStateService.setHasPremium(
      response.premiumPersonally,
      response.premiumFromOrganization,
      response.id,
    );
    await this.keyConnectorService.setUsesKeyConnector(response.usesKeyConnector, response.id);

    await this.setForceSetPasswordReasonIfNeeded(response);

    const providers: { [id: string]: ProviderData } = {};
    response.providers.forEach((p) => {
      providers[p.id] = new ProviderData(p);
    });

    await this.providerService.save(providers, response.id);

    await this.syncProfileOrganizations(response, response.id);

    if (await this.keyConnectorService.userNeedsMigration(response.id)) {
      await this.keyConnectorService.setConvertAccountRequired(true, response.id);
      this.messageSender.send("convertAccountToKeyConnector");
    } else {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.keyConnectorService.removeConvertAccountRequired(response.id);
    }
  }

  private async setForceSetPasswordReasonIfNeeded(profileResponse: ProfileResponse) {
    // The `forcePasswordReset` flag indicates an admin has reset the user's password and must be updated
    if (profileResponse.forcePasswordReset) {
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.AdminForcePasswordReset,
        profileResponse.id,
      );
    }

    const userDecryptionOptions = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptionsById$(profileResponse.id),
    );

    if (userDecryptionOptions === null || userDecryptionOptions === undefined) {
      this.logService.error("Sync: Account decryption options are null or undefined.");
    }

    // Even though TDE users should only be in a single org (per single org policy), check
    // through all orgs for the manageResetPassword permission. If they have it in any org,
    // they should be forced to set a password.
    let hasManageResetPasswordPermission = false;
    for (const org of profileResponse.organizations) {
      const isAdmin = org.type === OrganizationUserType.Admin;
      const isOwner = org.type === OrganizationUserType.Owner;

      // Note: apparently permissions only come down populated for custom roles.
      if (isAdmin || isOwner || (org.permissions && org.permissions.manageResetPassword)) {
        hasManageResetPasswordPermission = true;
        break;
      }
    }

    if (
      userDecryptionOptions.trustedDeviceOption !== undefined &&
      !userDecryptionOptions.hasMasterPassword &&
      hasManageResetPasswordPermission
    ) {
      // TDE user w/out MP went from having no password reset permission to having it.
      // Must set the force password reset reason so the auth guard will redirect to the set password page.
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
        userId,
      );
    }
  }

  private async syncProfileOrganizations(response: ProfileResponse, userId: UserId) {
    const organizations: { [id: string]: OrganizationData } = {};
    response.organizations.forEach((o) => {
      organizations[o.id] = new OrganizationData(o, {
        isMember: true,
        isProviderUser: false,
      });
    });

    response.providerOrganizations.forEach((o) => {
      if (organizations[o.id] == null) {
        organizations[o.id] = new OrganizationData(o, {
          isMember: false,
          isProviderUser: true,
        });
      } else {
        organizations[o.id].isProviderUser = true;
      }
    });

    await this.organizationService.replace(organizations, userId);
  }

  private async syncFolders(response: FolderResponse[], userId: UserId) {
    const folders: { [id: string]: FolderData } = {};
    response.forEach((f) => {
      folders[f.id] = new FolderData(f);
    });
    return await this.folderService.replace(folders, userId);
  }

  private async syncCollections(response: CollectionDetailsResponse[], userId: UserId) {
    const collections: { [id: string]: CollectionData } = {};
    response.forEach((c) => {
      collections[c.id] = new CollectionData(c);
    });
    return await this.collectionService.replace(collections, userId);
  }

  private async syncCiphers(response: CipherResponse[], userId: UserId) {
    const ciphers: { [id: string]: CipherData } = {};
    response.forEach((c) => {
      ciphers[c.id] = new CipherData(c);
    });
    return await this.cipherService.replace(ciphers, userId);
  }

  private async syncSends(response: SendResponse[], userId: UserId) {
    const sends: { [id: string]: SendData } = {};
    response.forEach((s) => {
      sends[s.id] = new SendData(s);
    });
    return await this.sendService.replace(sends, userId);
  }

  private async syncSettings(response: DomainsResponse, userId: UserId) {
    let eqDomains: string[][] = [];
    if (response != null && response.equivalentDomains != null) {
      eqDomains = eqDomains.concat(response.equivalentDomains);
    }

    if (response != null && response.globalEquivalentDomains != null) {
      response.globalEquivalentDomains.forEach((global) => {
        if (global.domains.length > 0) {
          eqDomains.push(global.domains);
        }
      });
    }

    return this.domainSettingsService.setEquivalentDomains(eqDomains, userId);
  }

  private async syncPolicies(response: PolicyResponse[], userId: UserId) {
    const policies: { [id: string]: PolicyData } = {};
    if (response != null) {
      response.forEach((p) => {
        policies[p.id] = new PolicyData(p);
      });
    }
    return await this.policyService.replace(policies, userId);
  }
}
