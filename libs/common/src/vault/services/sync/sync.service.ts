import { ApiService } from "../../../abstractions/api.service";
import { CollectionService } from "../../../abstractions/collection.service";
import { CryptoService } from "../../../abstractions/crypto.service";
import { LogService } from "../../../abstractions/log.service";
import { MessagingService } from "../../../abstractions/messaging.service";
import { InternalOrganizationService } from "../../../abstractions/organization/organization.service.abstraction";
import { InternalPolicyService } from "../../../abstractions/policy/policy.service.abstraction";
import { ProviderService } from "../../../abstractions/provider.service";
import { SendService } from "../../../abstractions/send.service";
import { SettingsService } from "../../../abstractions/settings.service";
import { StateService } from "../../../abstractions/state.service";
import { KeyConnectorService } from "../../../auth/abstractions/key-connector.service";
import { sequentialize } from "../../../misc/sequentialize";
import { CollectionData } from "../../../models/data/collection.data";
import { OrganizationData } from "../../../models/data/organization.data";
import { PolicyData } from "../../../models/data/policy.data";
import { ProviderData } from "../../../models/data/provider.data";
import { SendData } from "../../../models/data/send.data";
import { CollectionDetailsResponse } from "../../../models/response/collection.response";
import { DomainsResponse } from "../../../models/response/domains.response";
import {
  SyncCipherNotification,
  SyncFolderNotification,
  SyncSendNotification,
} from "../../../models/response/notification.response";
import { PolicyResponse } from "../../../models/response/policy.response";
import { ProfileResponse } from "../../../models/response/profile.response";
import { SendResponse } from "../../../models/response/send.response";
import { Guid } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "../../../vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "../../../vault/abstractions/folder/folder.service.abstraction";
import { SyncService as SyncServiceAbstraction } from "../../../vault/abstractions/sync/sync.service.abstraction";
import { CipherData } from "../../../vault/models/data/cipher.data";
import { FolderData } from "../../../vault/models/data/folder.data";
import { CipherResponse } from "../../../vault/models/response/cipher.response";
import { FolderResponse } from "../../../vault/models/response/folder.response";

export class SyncService implements SyncServiceAbstraction {
  syncInProgress = false;

  constructor(
    private apiService: ApiService,
    private settingsService: SettingsService,
    private folderService: InternalFolderService,
    private cipherService: CipherService,
    private cryptoService: CryptoService,
    private collectionService: CollectionService,
    private messagingService: MessagingService,
    private policyService: InternalPolicyService,
    private sendService: SendService,
    private logService: LogService,
    private keyConnectorService: KeyConnectorService,
    private stateService: StateService,
    private providerService: ProviderService,
    private folderApiService: FolderApiServiceAbstraction,
    private organizationService: InternalOrganizationService,
    private logoutCallback: (expired: boolean) => Promise<void>
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

  async setLastSync(date: Date, userId?: Guid): Promise<any> {
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
        const localSend = await this.sendService.get(notification.id);
        if (
          (!isEdit && localSend == null) ||
          (isEdit && localSend != null && localSend.revisionDate < notification.revisionDate)
        ) {
          const remoteSend = await this.apiService.getSend(notification.id);
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

    await this.cryptoService.setEncKey(response.key);
    await this.cryptoService.setEncPrivateKey(response.privateKey);
    await this.cryptoService.setProviderKeys(response.providers);
    await this.cryptoService.setOrgKeys(response.organizations, response.providerOrganizations);
    await this.stateService.setAvatarColor(response.avatarColor);
    await this.stateService.setSecurityStamp(response.securityStamp);
    await this.stateService.setEmailVerified(response.emailVerified);
    await this.stateService.setHasPremiumPersonally(response.premiumPersonally);
    await this.stateService.setHasPremiumFromOrganization(response.premiumFromOrganization);
    await this.stateService.setForcePasswordReset(response.forcePasswordReset);
    await this.keyConnectorService.setUsesKeyConnector(response.usesKeyConnector);

    const organizations: { [id: string]: OrganizationData } = {};
    response.organizations.forEach((o) => {
      organizations[o.id] = new OrganizationData(o);
    });

    const providers: { [id: string]: ProviderData } = {};
    response.providers.forEach((p) => {
      providers[p.id] = new ProviderData(p);
    });

    response.providerOrganizations.forEach((o) => {
      if (organizations[o.id] == null) {
        organizations[o.id] = new OrganizationData(o);
        organizations[o.id].isProviderUser = true;
      }
    });

    await this.organizationService.replace(organizations);
    await this.providerService.save(providers);

    if (await this.keyConnectorService.userNeedsMigration()) {
      await this.keyConnectorService.setConvertAccountRequired(true);
      this.messagingService.send("convertAccountToKeyConnector");
    } else {
      this.keyConnectorService.removeConvertAccountRequired();
    }
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

    return this.settingsService.setEquivalentDomains(eqDomains);
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
