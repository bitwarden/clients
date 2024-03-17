import { ApiService } from "../../../abstractions/api.service";
import { InternalOrganizationServiceAbstraction } from "../../../admin-console/abstractions/organization/organization.service.abstraction";
import { InternalPolicyService } from "../../../admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "../../../admin-console/abstractions/provider.service";
import { OrganizationUserType } from "../../../admin-console/enums";
import { OrganizationData } from "../../../admin-console/models/data/organization.data";
import { PolicyData } from "../../../admin-console/models/data/policy.data";
import { ProviderData } from "../../../admin-console/models/data/provider.data";
import { PolicyResponse } from "../../../admin-console/models/response/policy.response";
import { AvatarService } from "../../../auth/abstractions/avatar.service";
import { KeyConnectorService } from "../../../auth/abstractions/key-connector.service";
import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { DomainSettingsService } from "../../../autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "../../../billing/abstractions/account/billing-account-profile-state.service";
import { DomainsResponse } from "../../../models/response/domains.response";
import {
  SyncCipherNotification,
  SyncFolderNotification,
  SyncSendNotification,
} from "../../../models/response/notification.response";
import { ProfileResponse } from "../../../models/response/profile.response";
import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { MessagingService } from "../../../platform/abstractions/messaging.service";
import { StateService } from "../../../platform/abstractions/state.service";
import { sequentialize } from "../../../platform/misc/sequentialize";
import { AccountDecryptionOptions } from "../../../platform/models/domain/account";
import { SendData } from "../../../tools/send/models/data/send.data";
import { SendResponse } from "../../../tools/send/models/response/send.response";
import { SendApiService } from "../../../tools/send/services/send-api.service.abstraction";
import { InternalSendService } from "../../../tools/send/services/send.service.abstraction";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "../../../vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "../../../vault/abstractions/folder/folder.service.abstraction";
import { SyncService as SyncServiceAbstraction } from "../../../vault/abstractions/sync/sync.service.abstraction";
import { CipherData } from "../../../vault/models/data/cipher.data";
import { FolderData } from "../../../vault/models/data/folder.data";
import { CipherResponse } from "../../../vault/models/response/cipher.response";
import { FolderResponse } from "../../../vault/models/response/folder.response";
import { CollectionService } from "../../abstractions/collection.service";
import { CollectionData } from "../../models/data/collection.data";
import { CollectionDetailsResponse } from "../../models/response/collection.response";

export class SyncService implements SyncServiceAbstraction {
  syncInProgress = false;

  constructor(
    private apiService: ApiService,
    private domainSettingsService: DomainSettingsService,
    private folderService: InternalFolderService,
    private cipherService: CipherService,
    private cryptoService: CryptoService,
    private collectionService: CollectionService,
    private messagingService: MessagingService,
    private policyService: InternalPolicyService,
    private sendService: InternalSendService,
    private logService: LogService,
    private keyConnectorService: KeyConnectorService,
    private stateService: StateService,
    private providerService: ProviderService,
    private folderApiService: FolderApiServiceAbstraction,
    private organizationService: InternalOrganizationServiceAbstraction,
    private sendApiService: SendApiService,
    private avatarService: AvatarService,
    private logoutCallback: (expired: boolean) => Promise<void>,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {}

  async getLastSync(): Promise<Date> {
    if ((await this.stateService.getUserId()) == null) {
      return null;
    }

    const lastSync = await this.stateService.getLastSync();
    if (lastSync) {
      return new Date(lastSync);
    }

    return null;
  }

  async setLastSync(date: Date, userId?: string): Promise<any> {
    await this.stateService.setLastSync(date.toJSON(), { userId: userId });
  }

  @sequentialize(() => "fullSync")
  async fullSync(forceSync: boolean, allowThrowOnError = false): Promise<boolean> {
    this.syncStarted();
    const isAuthenticated = await this.stateService.getIsAuthenticated();
    if (!isAuthenticated) {
      return this.syncCompleted(false);
    }

    const now = new Date();
    let needsSync = false;
    try {
      needsSync = await this.needsSyncing(forceSync);
    } catch (e) {
      if (allowThrowOnError) {
        throw e;
      }
    }

    if (!needsSync) {
      await this.setLastSync(now);
      return this.syncCompleted(false);
    }

    try {
      await this.apiService.refreshIdentityToken();
      const response = await this.apiService.getSync();

      await this.syncProfile(response.profile);
      await this.syncFolders(response.folders);
      await this.syncCollections(response.collections);
      await this.syncCiphers(response.ciphers);
      await this.syncSends(response.sends);
      await this.syncSettings(response.domains);
      await this.syncPolicies(response.policies);

      await this.setLastSync(now);
      return this.syncCompleted(true);
    } catch (e) {
      if (allowThrowOnError) {
        throw e;
      } else {
        return this.syncCompleted(false);
      }
    }
  }

  async syncUpsertFolder(notification: SyncFolderNotification, isEdit: boolean): Promise<boolean> {
    this.syncStarted();
    if (await this.stateService.getIsAuthenticated()) {
      try {
        const localFolder = await this.folderService.get(notification.id);
        if (
          (!isEdit && localFolder == null) ||
          (isEdit && localFolder != null && localFolder.revisionDate < notification.revisionDate)
        ) {
          const remoteFolder = await this.folderApiService.get(notification.id);
          if (remoteFolder != null) {
            await this.folderService.upsert(new FolderData(remoteFolder));
            this.messagingService.send("syncedUpsertedFolder", { folderId: notification.id });
            return this.syncCompleted(true);
          }
        }
      } catch (e) {
        this.logService.error(e);
      }
    }
    return this.syncCompleted(false);
  }

  async syncDeleteFolder(notification: SyncFolderNotification): Promise<boolean> {
    this.syncStarted();
    if (await this.stateService.getIsAuthenticated()) {
      await this.folderService.delete(notification.id);
      this.messagingService.send("syncedDeletedFolder", { folderId: notification.id });
      this.syncCompleted(true);
      return true;
    }
    return this.syncCompleted(false);
  }

  async syncUpsertCipher(notification: SyncCipherNotification, isEdit: boolean): Promise<boolean> {
    this.syncStarted();
    if (await this.stateService.getIsAuthenticated()) {
      try {
        let shouldUpdate = true;
        const localCipher = await this.cipherService.get(notification.id);
        if (localCipher != null && localCipher.revisionDate >= notification.revisionDate) {
          shouldUpdate = false;
        }

        let checkCollections = false;
        if (shouldUpdate) {
          if (isEdit) {
            shouldUpdate = localCipher != null;
            checkCollections = true;
          } else {
            if (notification.collectionIds == null || notification.organizationId == null) {
              shouldUpdate = localCipher == null;
            } else {
              shouldUpdate = false;
              checkCollections = true;
            }
          }
        }

        if (
          !shouldUpdate &&
          checkCollections &&
          notification.organizationId != null &&
          notification.collectionIds != null &&
          notification.collectionIds.length > 0
        ) {
          const collections = await this.collectionService.getAll();
          if (collections != null) {
            for (let i = 0; i < collections.length; i++) {
              if (notification.collectionIds.indexOf(collections[i].id) > -1) {
                shouldUpdate = true;
                break;
              }
            }
          }
        }

        if (shouldUpdate) {
          const remoteCipher = await this.apiService.getFullCipherDetails(notification.id);
          if (remoteCipher != null) {
            await this.cipherService.upsert(new CipherData(remoteCipher));
            this.messagingService.send("syncedUpsertedCipher", { cipherId: notification.id });
            return this.syncCompleted(true);
          }
        }
      } catch (e) {
        if (e != null && e.statusCode === 404 && isEdit) {
          await this.cipherService.delete(notification.id);
          this.messagingService.send("syncedDeletedCipher", { cipherId: notification.id });
          return this.syncCompleted(true);
        }
      }
    }
    return this.syncCompleted(false);
  }

  async syncDeleteCipher(notification: SyncCipherNotification): Promise<boolean> {
    this.syncStarted();
    if (await this.stateService.getIsAuthenticated()) {
      await this.cipherService.delete(notification.id);
      this.messagingService.send("syncedDeletedCipher", { cipherId: notification.id });
      return this.syncCompleted(true);
    }
    return this.syncCompleted(false);
  }

  async syncUpsertSend(notification: SyncSendNotification, isEdit: boolean): Promise<boolean> {
    this.syncStarted();
    if (await this.stateService.getIsAuthenticated()) {
      try {
        const localSend = this.sendService.get(notification.id);
        if (
          (!isEdit && localSend == null) ||
          (isEdit && localSend != null && localSend.revisionDate < notification.revisionDate)
        ) {
          const remoteSend = await this.sendApiService.getSend(notification.id);
          if (remoteSend != null) {
            await this.sendService.upsert(new SendData(remoteSend));
            this.messagingService.send("syncedUpsertedSend", { sendId: notification.id });
            return this.syncCompleted(true);
          }
        }
      } catch (e) {
        this.logService.error(e);
      }
    }
    return this.syncCompleted(false);
  }

  async syncDeleteSend(notification: SyncSendNotification): Promise<boolean> {
    this.syncStarted();
    if (await this.stateService.getIsAuthenticated()) {
      await this.sendService.delete(notification.id);
      this.messagingService.send("syncedDeletedSend", { sendId: notification.id });
      this.syncCompleted(true);
      return true;
    }
    return this.syncCompleted(false);
  }

  // Helpers

  private syncStarted() {
    this.syncInProgress = true;
    this.messagingService.send("syncStarted");
  }

  private syncCompleted(successfully: boolean): boolean {
    this.syncInProgress = false;
    this.messagingService.send("syncCompleted", { successfully: successfully });
    return successfully;
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
    if (new Date(response) <= lastSync) {
      return false;
    }
    return true;
  }

  private async syncProfile(response: ProfileResponse) {
    const stamp = await this.stateService.getSecurityStamp();
    if (stamp != null && stamp !== response.securityStamp) {
      if (this.logoutCallback != null) {
        await this.logoutCallback(true);
      }

      throw new Error("Stamp has changed");
    }

    await this.cryptoService.setMasterKeyEncryptedUserKey(response.key);
    await this.cryptoService.setPrivateKey(response.privateKey);
    await this.cryptoService.setProviderKeys(response.providers);
    await this.cryptoService.setOrgKeys(response.organizations, response.providerOrganizations);
    await this.avatarService.setAvatarColor(response.avatarColor);
    await this.stateService.setSecurityStamp(response.securityStamp);
    await this.stateService.setEmailVerified(response.emailVerified);

    await this.billingAccountProfileStateService.setHasPremium(
      response.premiumPersonally,
      response.premiumFromOrganization,
    );
    await this.keyConnectorService.setUsesKeyConnector(response.usesKeyConnector);

    await this.setForceSetPasswordReasonIfNeeded(response);

    const providers: { [id: string]: ProviderData } = {};
    response.providers.forEach((p) => {
      providers[p.id] = new ProviderData(p);
    });

    await this.providerService.save(providers);

    await this.syncProfileOrganizations(response);

    if (await this.keyConnectorService.userNeedsMigration()) {
      await this.keyConnectorService.setConvertAccountRequired(true);
      this.messagingService.send("convertAccountToKeyConnector");
    } else {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.keyConnectorService.removeConvertAccountRequired();
    }
  }

  private async setForceSetPasswordReasonIfNeeded(profileResponse: ProfileResponse) {
    // The `forcePasswordReset` flag indicates an admin has reset the user's password and must be updated
    if (profileResponse.forcePasswordReset) {
      await this.stateService.setForceSetPasswordReason(
        ForceSetPasswordReason.AdminForcePasswordReset,
      );
    }

    const acctDecryptionOpts: AccountDecryptionOptions =
      await this.stateService.getAccountDecryptionOptions();

    // Account decryption options should never be null or undefined b/c it is always initialized
    // during the processing of the ID token response, but there might be a state issue
    // where it is being overwritten with undefined affecting browser extension + FireFox users.
    // TODO: Consider removing this once we figure out the root cause of the state issue or after the state provider refactor.
    if (acctDecryptionOpts === null || acctDecryptionOpts === undefined) {
      this.logService.error("Sync: Account decryption options are null or undefined.");
      // Early return as a bandaid to allow the rest of the sync to continue so users can access
      // their data that they might have added from another device.
      // Otherwise, trying to access properties on undefined below will throw an error.
      return;
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
      acctDecryptionOpts.trustedDeviceOption !== undefined &&
      !acctDecryptionOpts.hasMasterPassword &&
      hasManageResetPasswordPermission
    ) {
      // TDE user w/out MP went from having no password reset permission to having it.
      // Must set the force password reset reason so the auth guard will redirect to the set password page.
      await this.stateService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
      );
    }
  }

  private async syncProfileOrganizations(response: ProfileResponse) {
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

    await this.organizationService.replace(organizations);
  }

  private async syncFolders(response: FolderResponse[]) {
    const folders: { [id: string]: FolderData } = {};
    response.forEach((f) => {
      folders[f.id] = new FolderData(f);
    });
    return await this.folderService.replace(folders);
  }

  private async syncCollections(response: CollectionDetailsResponse[]) {
    const collections: { [id: string]: CollectionData } = {};
    response.forEach((c) => {
      collections[c.id] = new CollectionData(c);
    });
    return await this.collectionService.replace(collections);
  }

  private async syncCiphers(response: CipherResponse[]) {
    const ciphers: { [id: string]: CipherData } = {};
    response.forEach((c) => {
      ciphers[c.id] = new CipherData(c);
    });
    return await this.cipherService.replace(ciphers);
  }

  private async syncSends(response: SendResponse[]) {
    const sends: { [id: string]: SendData } = {};
    response.forEach((s) => {
      sends[s.id] = new SendData(s);
    });
    return await this.sendService.replace(sends);
  }

  private async syncSettings(response: DomainsResponse) {
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

    return this.domainSettingsService.setEquivalentDomains(eqDomains);
  }

  private async syncPolicies(response: PolicyResponse[]) {
    const policies: { [id: string]: PolicyData } = {};
    if (response != null) {
      response.forEach((p) => {
        policies[p.id] = new PolicyData(p);
      });
    }
    return await this.policyService.replace(policies);
  }
}
