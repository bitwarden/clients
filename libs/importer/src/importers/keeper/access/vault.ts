import { Client, ClientOptions } from "./client";
import { base64UrlEncode, decryptAesV1, decryptAesV2, decryptKeeperKey } from "./crypto";
import * as sd from "./generated/SyncDown";

export type VaultItem = RecordV3 & {
  id: string;
  folders: string[];
};

export type VaultField = {
  type: string;
  value: unknown[];
  label?: string;
};

// TODO: Add RecordV2!

type RecordV3 = {
  type: string;
  title: string;
  notes: string;
  fields: VaultField[];
  custom: VaultField[];
};

type Decryptor = (data: Uint8Array, key: Uint8Array) => Promise<Uint8Array>;

export class Vault {
  static async open(username: string, password: string, options: ClientOptions): Promise<Vault> {
    const client = new Client(options);
    const loginResult = await client.login(username, password, options);

    const pages = await client.syncDown(loginResult.sessionToken);
    const merged = Vault.mergeSyncDownPages(pages);
    return await Vault.processMergedSyncDownPages(merged, loginResult.dataKey);
  }

  getItems(): VaultItem[] {
    return this.items;
  }

  //
  // Private
  //

  private constructor(private readonly items: VaultItem[]) {}

  // SyncDown can return multiple pages of data. This function merges them into a single response.
  private static mergeSyncDownPages(pages: sd.SyncDownResponse[]): sd.SyncDownResponse {
    if (pages.length === 1) {
      return pages[0];
    }

    const merged = pages[0];
    for (let i = 1; i < pages.length; i++) {
      const page = pages[i];
      merged.userFolders.push(...page.userFolders);
      merged.sharedFolders.push(...page.sharedFolders);
      merged.userFolderSharedFolders.push(...page.userFolderSharedFolders);
      merged.sharedFolderFolders.push(...page.sharedFolderFolders);
      merged.records.push(...page.records);
      merged.recordMetaData.push(...page.recordMetaData);
      merged.nonSharedData.push(...page.nonSharedData);
      merged.recordLinks.push(...page.recordLinks);
      merged.userFolderRecords.push(...page.userFolderRecords);
      merged.sharedFolderRecords.push(...page.sharedFolderRecords);
      merged.sharedFolderFolderRecords.push(...page.sharedFolderFolderRecords);
      merged.sharedFolderUsers.push(...page.sharedFolderUsers);
      merged.sharedFolderTeams.push(...page.sharedFolderTeams);
      merged.recordAddAuditData.push(...page.recordAddAuditData);
      merged.teams.push(...page.teams);
      merged.sharingChanges.push(...page.sharingChanges);
      merged.pendingTeamMembers.push(...page.pendingTeamMembers);
      merged.breachWatchRecords.push(...page.breachWatchRecords);
      merged.userAuths.push(...page.userAuths);
      merged.breachWatchSecurityData.push(...page.breachWatchSecurityData);
      merged.removedUserFolders.push(...page.removedUserFolders);
      merged.removedSharedFolders.push(...page.removedSharedFolders);
      merged.removedUserFolderSharedFolders.push(...page.removedUserFolderSharedFolders);
      merged.removedSharedFolderFolders.push(...page.removedSharedFolderFolders);
      merged.removedRecords.push(...page.removedRecords);
      merged.removedRecordLinks.push(...page.removedRecordLinks);
      merged.removedUserFolderRecords.push(...page.removedUserFolderRecords);
      merged.removedSharedFolderRecords.push(...page.removedSharedFolderRecords);
      merged.removedSharedFolderFolderRecords.push(...page.removedSharedFolderFolderRecords);
      merged.removedSharedFolderUsers.push(...page.removedSharedFolderUsers);
      merged.removedSharedFolderTeams.push(...page.removedSharedFolderTeams);
      merged.removedTeams.push(...page.removedTeams);
      merged.ksmAppShares.push(...page.ksmAppShares);
      merged.ksmAppClients.push(...page.ksmAppClients);
      merged.shareInvitations.push(...page.shareInvitations);
      merged.recordRotations.push(...page.recordRotations);
      merged.users.push(...page.users);
      merged.removedUsers.push(...page.removedUsers);
      merged.securityScoreData.push(...page.securityScoreData);
      merged.notificationSync.push(...page.notificationSync);

      merged.continuationToken = page.continuationToken;
      merged.hasMore = page.hasMore;
      merged.cacheStatus = page.cacheStatus;
    }

    return merged;
  }

  // Processes the merged SyncDown response and decrypts all data to build the Vault.
  private static async processMergedSyncDownPages(
    merged: sd.SyncDownResponse,
    masterKey: Uint8Array,
  ): Promise<Vault> {
    // 1. Each folder is encrypted with its own folder key that is encrypted with the master key.
    //    We only need the folder names.
    const folders = await Vault.decryptFolderNames(merged.userFolders, masterKey);

    // 2. Shared folders also have their own keys. Those keys are also needed to decrypt the records in the shared folder.
    const sharedFolderKeys = await Vault.decryptSharedFolderKeys(merged.sharedFolders, masterKey);

    // 3. Shared folder names are encrypted with the shared folder keys.
    const sharedFolders = await Vault.decryptSharedFolderNames(
      merged.sharedFolders,
      sharedFolderKeys,
    );

    // 4. Non-shared record keys are stored in the record metadata. They are encrypted with the master key.
    const recordKeys = await Vault.decryptRecordKeys(merged.recordMetaData, masterKey);

    // 5. Shared record keys are stored in the shared folder records. They are encrypted with the shared folder key.
    const sharedRecordKeys = await Vault.decryptSharedFolderRecordKeys(
      merged.sharedFolderRecords,
      sharedFolderKeys,
    );

    // 6. Now all records can be decrypted.
    const allRecordKeys = new Map([...recordKeys, ...sharedRecordKeys]);
    const [records] = await Vault.decryptRecords(merged.records, allRecordKeys);

    // 7. Decrypt shared folder subfolder names.
    const sharedFolderSubfolderNames = await Vault.decryptSharedFolderFolderNames(
      merged.sharedFolderFolders,
      sharedFolderKeys,
    );

    // 8. Build full folder paths
    const folderPaths = Vault.buildRecordFolderPaths(
      merged.userFolders,
      merged.sharedFolders,
      merged.sharedFolderFolders,
      merged.userFolderSharedFolders,
      new Map([...folders, ...sharedFolders, ...sharedFolderSubfolderNames]),
    );

    // 9. Collect all folder paths for each record.
    const recordFolders = Vault.buildRecordFolders(
      merged.userFolderRecords,
      merged.sharedFolderRecords,
      merged.sharedFolderFolderRecords,
      folderPaths,
    );

    // 10. Combine records with their folder paths into VaultItems.
    const items: VaultItem[] = [];
    for (const [uid, record] of records) {
      items.push({
        ...record,
        id: uid,
        folders: recordFolders.get(uid) ?? [],
      });
    }

    return new Vault(items);
  }

  private static async decryptFolderNames(
    userFolders: sd.UserFolder[],
    masterKey: Uint8Array,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const folder of userFolders) {
      const uid = uidToString(folder.folderUid);
      const folderKey = await decryptKeeperKey(folder.userFolderKey, folder.keyType, masterKey);
      const decrypted = await Vault.decryptJsonV1<{ name: string }>(folder.data, folderKey);
      result.set(uid, decrypted.name);
    }
    return result;
  }

  private static async decryptSharedFolderKeys(
    sharedFolders: sd.SharedFolder[],
    masterKey: Uint8Array,
  ): Promise<Map<string, Uint8Array>> {
    const result = new Map<string, Uint8Array>();
    for (const folder of sharedFolders) {
      const uid = uidToString(folder.sharedFolderUid);
      try {
        const key = await decryptKeeperKey(folder.sharedFolderKey, folder.keyType, masterKey);
        result.set(uid, key);
      } catch {
        // TODO: Log this?
      }
    }
    return result;
  }

  private static async decryptSharedFolderNames(
    sharedFolders: sd.SharedFolder[],
    keys: Map<string, Uint8Array>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const folder of sharedFolders) {
      const uid = uidToString(folder.sharedFolderUid);
      const key = keys.get(uid);
      if (!key) {
        continue;
      }
      try {
        const name = folder.data
          ? (await Vault.decryptJsonV1<{ name: string }>(folder.data, key)).name
          : await Vault.decryptString(folder.name, key, decryptAesV1);
        result.set(uid, name);
      } catch {
        // TODO: Log this?
      }
    }
    return result;
  }

  private static async decryptSharedFolderRecordKeys(
    sharedFolderRecords: sd.SharedFolderRecord[],
    sharedFolderKeys: Map<string, Uint8Array>,
  ): Promise<Map<string, Uint8Array>> {
    const result = new Map<string, Uint8Array>();
    for (const sfr of sharedFolderRecords) {
      const uid = uidToString(sfr.sharedFolderUid);
      const key = sharedFolderKeys.get(uid);
      if (!key) {
        continue;
      }
      try {
        const encryptedKey = new Uint8Array(sfr.recordKey);
        const recordKey =
          encryptedKey.length === 60
            ? await decryptAesV2(encryptedKey, key)
            : await decryptAesV1(encryptedKey, key);
        result.set(uidToString(sfr.recordUid), recordKey);
      } catch {
        // TODO: Log this?
      }
    }
    return result;
  }

  private static async decryptRecordKeys(
    metaData: sd.RecordMetaData[],
    masterKey: Uint8Array,
  ): Promise<Map<string, Uint8Array>> {
    const result = new Map<string, Uint8Array>();
    for (const meta of metaData) {
      const uid = uidToString(meta.recordUid);
      const recordKey = await decryptKeeperKey(meta.recordKey, meta.recordKeyType, masterKey);
      result.set(uid, recordKey);
    }
    return result;
  }

  private static async decryptRecords(
    records: sd.Record[],
    keys: Map<string, Uint8Array>,
  ): Promise<[Map<string, RecordV3>, sd.Record[]]> {
    const result = new Map<string, RecordV3>();
    const failed: sd.Record[] = [];
    for (const record of records) {
      const uid = uidToString(record.recordUid);
      const key = keys.get(uid);
      if (key) {
        if (record.version < 3) {
          throw new Error("V1 records are not supported yet");
        } else {
          const r = await Vault.decryptJsonV2<Partial<RecordV3>>(record.data, keys.get(uid));
          result.set(uid, {
            type: r.type ?? "",
            title: r.title ?? "",
            notes: r.notes ?? "",
            fields: r.fields ?? [],
            custom: r.custom ?? [],
          });
        }
      } else {
        failed.push(record);
      }
    }
    return [result, failed];
  }

  private static async decryptSharedFolderFolderNames(
    sharedFolderFolders: sd.SharedFolderFolder[],
    sharedFolderKeys: Map<string, Uint8Array>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const sff of sharedFolderFolders) {
      const sfUid = uidToString(sff.sharedFolderUid);
      const sfKey = sharedFolderKeys.get(sfUid);
      if (!sfKey) {
        continue;
      }
      try {
        const folderKey = await decryptKeeperKey(sff.sharedFolderFolderKey, sff.keyType, sfKey);
        const decrypted = await Vault.decryptJsonV1<{ name: string }>(sff.data, folderKey);
        result.set(uidToString(sff.folderUid), decrypted.name);
      } catch {
        // skip folders we can't decrypt
      }
    }
    return result;
  }

  private static buildRecordFolderPaths(
    folders: sd.UserFolder[],
    sharedFolders: sd.SharedFolder[],
    sharedFoldersFolder: sd.SharedFolderFolder[],
    sharedFolderSharedFolders: sd.UserFolderSharedFolder[],
    folderNames: Map<string, string>,
  ): Map<string, string> {
    const paths = new Map<string, string>();
    const childToParent = new Map<string, string>();

    // 1. Normal folders. Defines the relationship between a folder and its parent.
    for (const folder of folders) {
      const uid = uidToString(folder.folderUid);
      const parentUid = uidToString(folder.parentUid);
      childToParent.set(uid, parentUid);
    }

    // 2. Shared folders. Defines the relationship between a shared folder and its parent.
    for (const folder of sharedFolderSharedFolders) {
      const uid = uidToString(folder.sharedFolderUid);
      const folderUid = uidToString(folder.folderUid);
      childToParent.set(uid, folderUid);
    }

    // 3. Shared folder subfolders. Defines the relationship between a subfolder and its parent (shared folder or another subfolder).
    for (const sff of sharedFoldersFolder) {
      const uid = uidToString(sff.folderUid);
      const parentUid =
        sff.parentUid.length > 0 ? uidToString(sff.parentUid) : uidToString(sff.sharedFolderUid);
      childToParent.set(uid, parentUid);
    }

    // 4. Walk up the parent chain to build full paths for every folder.
    const getPath = (uid: string): string => {
      if (paths.has(uid)) {
        return paths.get(uid)!;
      }
      const name = sanitizeFolderName(folderNames.get(uid) ?? uid);
      const parentUid = childToParent.get(uid);
      if (!parentUid) {
        paths.set(uid, name);
        return name;
      }
      const parentPath = getPath(parentUid);
      const path = joinPath(parentPath, name);
      paths.set(uid, path);
      return path;
    };

    for (const uid of childToParent.keys()) {
      getPath(uid);
    }

    return paths;
  }

  private static buildRecordFolders(
    userFolderRecords: sd.UserFolderRecord[],
    sharedFolderRecords: sd.SharedFolderRecord[],
    sharedFolderFolderRecords: sd.SharedFolderFolderRecord[],
    folderPaths: Map<string, string>,
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();

    const addPath = (recordUid: string, folderUid: string) => {
      const path = folderPaths.get(folderUid);
      if (!result.has(recordUid)) {
        result.set(recordUid, []);
      }
      if (path) {
        result.get(recordUid)!.push(path);
      }
    };

    // Records in normal folders
    for (const r of userFolderRecords) {
      addPath(uidToString(r.recordUid), uidToString(r.folderUid));
    }

    // Records in the root of shared folders
    for (const r of sharedFolderRecords) {
      addPath(uidToString(r.recordUid), uidToString(r.sharedFolderUid));
    }

    // Records in subfolders of shared folders
    for (const r of sharedFolderFolderRecords) {
      addPath(uidToString(r.recordUid), uidToString(r.folderUid));
    }

    return result;
  }

  private static async decryptJsonV1<T>(data: Uint8Array, key: Uint8Array): Promise<T> {
    return await Vault.decryptJson(data, key, decryptAesV1);
  }

  private static async decryptJsonV2<T>(data: Uint8Array, key: Uint8Array): Promise<T> {
    return await Vault.decryptJson(data, key, decryptAesV2);
  }

  private static async decryptJson<T>(
    data: Uint8Array,
    key: Uint8Array,
    decrypt: Decryptor,
  ): Promise<T> {
    return JSON.parse(await Vault.decryptString(data, key, decrypt));
  }

  private static async decryptString(
    data: Uint8Array,
    key: Uint8Array,
    decrypt: Decryptor,
  ): Promise<string> {
    return new TextDecoder().decode(await decrypt(data, key));
  }
}

function uidToString(uid: Uint8Array): string {
  return base64UrlEncode(uid);
}

function sanitizeFolderName(name: string): string {
  return name.replaceAll("\\", "-").replaceAll("/", "-");
}

function joinPath(parent: string, child: string): string {
  return parent ? parent + "/" + child : child;
}
