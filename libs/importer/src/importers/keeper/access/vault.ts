import { Client, ClientOptions } from "./client";
import { base64UrlEncode, decryptAesV1, decryptAesV2, decryptKeeperKey } from "./crypto";
import {
  SharedFolder,
  SharedFolderFolder,
  SharedFolderFolderRecord,
  SyncDownResponse,
  UserFolder,
  UserFolderRecord,
  UserFolderSharedFolder,
  Record,
  RecordMetaData,
  SharedFolderRecord,
} from "./generated/SyncDown";

//
// New models
//

type RecordV3 = {
  type: string;
  title: string;
  notes: string;
  fields: FieldV3[];
  customFields: FieldV3[];
};

type FieldV3 = {
  type: string;
  value: unknown[];
  label?: string;
};

export type VaultItem = RecordV3 & {
  id: string;
  folders: string[];
};

type Decryptor = (data: Uint8Array, key: Uint8Array) => Promise<Uint8Array>;

export class Vault {
  static async open(username: string, password: string, options: ClientOptions): Promise<Vault> {
    const client = new Client(options);
    const loginResult = await client.login(username, password, options);

    const pages = await client.syncDown(loginResult.sessionToken);
    const merged = Vault.mergeSyncDownPages(pages);
    return await Vault.processNew(merged, loginResult.dataKey);
  }

  getItems(): VaultItem[] {
    return this.items;
  }

  //
  // Private
  //

  private constructor(private readonly items: VaultItem[]) {}

  private static mergeSyncDownPages(pages: SyncDownResponse[]): SyncDownResponse {
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

  private static async processNew(merged: SyncDownResponse, masterKey: Uint8Array): Promise<Vault> {
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

    // 6. All record keys.
    const allRecordKeys = new Map([...recordKeys, ...sharedRecordKeys]);

    // 7. Now all records can be decrypted.
    const [records, failedRecords] = await Vault.decryptRecords(merged.records, allRecordKeys);

    // 8. Decrypt shared folder subfolder names.
    const sharedFolderFolderNames = await Vault.decryptSharedFolderFolderNames(
      merged.sharedFolderFolders,
      sharedFolderKeys,
    );

    // 9. Build full folder paths for each record.
    const recordFolderPaths = Vault.buildRecordFolderPaths(
      merged.userFolders,
      merged.userFolderSharedFolders,
      merged.sharedFolderFolders,
      merged.userFolderRecords,
      merged.sharedFolderRecords,
      merged.sharedFolderFolderRecords,
      folders,
      sharedFolders,
      sharedFolderFolderNames,
    );

    // 10. Combine records with their folder paths into VaultItems.
    const items: VaultItem[] = [];
    for (const [uid, record] of records) {
      items.push({
        ...record,
        id: uid,
        folders: recordFolderPaths.get(uid) ?? [],
      });
    }

    return new Vault(items);
  }

  private static async decryptFolderNames(
    userFolders: UserFolder[],
    masterKey: Uint8Array,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const folder of userFolders) {
      const uid = base64UrlEncode(folder.folderUid);
      const folderKey = await decryptKeeperKey(folder.userFolderKey, folder.keyType, masterKey);
      const decrypted = await Vault.decryptJsonV1<{ name: string }>(folder.data, folderKey);
      result.set(uid, decrypted.name);
    }
    return result;
  }

  private static async decryptSharedFolderKeys(
    sharedFolders: SharedFolder[],
    masterKey: Uint8Array,
  ): Promise<Map<string, Uint8Array>> {
    const result = new Map<string, Uint8Array>();
    for (const folder of sharedFolders) {
      const uid = base64UrlEncode(folder.sharedFolderUid);
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
    sharedFolders: SharedFolder[],
    keys: Map<string, Uint8Array>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const folder of sharedFolders) {
      const uid = base64UrlEncode(folder.sharedFolderUid);
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
    sharedFolderRecords: SharedFolderRecord[],
    sharedFolderKeys: Map<string, Uint8Array>,
  ): Promise<Map<string, Uint8Array>> {
    const result = new Map<string, Uint8Array>();
    for (const sfr of sharedFolderRecords) {
      const uid = base64UrlEncode(sfr.sharedFolderUid);
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
        result.set(base64UrlEncode(sfr.recordUid), recordKey);
      } catch {
        // TODO: Log this?
      }
    }
    return result;
  }

  private static async decryptRecordKeys(
    metaData: RecordMetaData[],
    masterKey: Uint8Array,
  ): Promise<Map<string, Uint8Array>> {
    const result = new Map<string, Uint8Array>();
    for (const meta of metaData) {
      const uid = base64UrlEncode(meta.recordUid);
      const recordKey = await decryptKeeperKey(meta.recordKey, meta.recordKeyType, masterKey);
      result.set(uid, recordKey);
    }
    return result;
  }

  private static async decryptRecords(
    records: Record[],
    keys: Map<string, Uint8Array>,
  ): Promise<[Map<string, RecordV3>, Record[]]> {
    const result = new Map<string, RecordV3>();
    const failed: Record[] = [];
    for (const record of records) {
      const uid = base64UrlEncode(record.recordUid);
      const key = keys.get(uid);
      if (key) {
        if (record.version < 3) {
          const decrypted = await Vault.decryptJsonV1(record.data, keys.get(uid));
          throw new Error("V1 records are not supported yet");
        } else {
          const r = await Vault.decryptJsonV2<Partial<RecordV3>>(record.data, keys.get(uid));
          result.set(uid, {
            type: r.type ?? "",
            title: r.title ?? "",
            notes: r.notes ?? "",
            fields: r.fields ?? [],
            customFields: r.customFields ?? [],
          });
        }
      } else {
        failed.push(record);
      }
    }
    return [result, failed];
  }

  private static async decryptSharedFolderFolderNames(
    sharedFolderFolders: SharedFolderFolder[],
    sharedFolderKeys: Map<string, Uint8Array>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const sff of sharedFolderFolders) {
      const sfUid = base64UrlEncode(sff.sharedFolderUid);
      const sfKey = sharedFolderKeys.get(sfUid);
      if (!sfKey) {
        continue;
      }
      try {
        const folderKey = await decryptKeeperKey(sff.sharedFolderFolderKey, sff.keyType, sfKey);
        const decrypted = await Vault.decryptJsonV1<{ name: string }>(sff.data, folderKey);
        result.set(base64UrlEncode(sff.folderUid), decrypted.name);
      } catch {
        // skip folders we can't decrypt
      }
    }
    return result;
  }

  private static buildRecordFolderPaths(
    userFolders: UserFolder[],
    userFolderSharedFolders: UserFolderSharedFolder[],
    sharedFolderFolders: SharedFolderFolder[],
    userFolderRecords: UserFolderRecord[],
    sharedFolderRecords: SharedFolderRecord[],
    sharedFolderFolderRecords: SharedFolderFolderRecord[],
    folderNames: Map<string, string>,
    sharedFolderNames: Map<string, string>,
    sharedFolderFolderNames: Map<string, string>,
  ): Map<string, string[]> {
    // Build a flat uid -> { name, parentUid } map for all folder types
    const tree = new Map<string, { name: string; parentUid: string }>();

    // User folders
    for (const uf of userFolders) {
      const uid = base64UrlEncode(uf.folderUid);
      const parentUid = uf.parentUid.length > 0 ? base64UrlEncode(uf.parentUid) : "";
      const name = folderNames.get(uid) ?? uid;
      tree.set(uid, { name: sanitizeFolderName(name), parentUid });
    }

    // Shared folders (placed under user folders via userFolderSharedFolders)
    for (const sf of userFolderSharedFolders) {
      const sfUid = base64UrlEncode(sf.sharedFolderUid);
      const parentUid = sf.folderUid.length > 0 ? base64UrlEncode(sf.folderUid) : "";
      const name = sharedFolderNames.get(sfUid) ?? sfUid;
      tree.set(sfUid, { name: sanitizeFolderName(name), parentUid });
    }

    // Shared folder subfolders
    for (const sff of sharedFolderFolders) {
      const uid = base64UrlEncode(sff.folderUid);
      const sfUid = base64UrlEncode(sff.sharedFolderUid);
      // If no parent, the parent is the shared folder itself
      const parentUid = sff.parentUid.length > 0 ? base64UrlEncode(sff.parentUid) : sfUid;
      const name = sharedFolderFolderNames.get(uid) ?? uid;
      tree.set(uid, { name: sanitizeFolderName(name), parentUid });
    }

    // Helper to walk up the tree and build a full path
    const getPath = (uid: string): string => {
      const parts: string[] = [];
      let current = uid;
      const visited = new Set<string>();
      while (current && tree.has(current)) {
        if (visited.has(current)) {
          break;
        }
        visited.add(current);
        const node = tree.get(current)!;
        parts.unshift(node.name);
        current = node.parentUid;
      }
      return parts.join("/");
    };

    // Build record -> folder paths
    const result = new Map<string, string[]>();

    const addRecordFolder = (recordUid: string, folderUid: string) => {
      const path = getPath(folderUid);
      if (!path) {
        return;
      }
      let paths = result.get(recordUid);
      if (!paths) {
        paths = [];
        result.set(recordUid, paths);
      }
      if (!paths.includes(path)) {
        paths.push(path);
      }
    };

    // Records in user folders
    for (const ufr of userFolderRecords) {
      addRecordFolder(base64UrlEncode(ufr.recordUid), base64UrlEncode(ufr.folderUid));
    }

    // Records at shared folder root
    for (const sfr of sharedFolderRecords) {
      addRecordFolder(base64UrlEncode(sfr.recordUid), base64UrlEncode(sfr.sharedFolderUid));
    }

    // Records in shared folder subfolders
    for (const sffr of sharedFolderFolderRecords) {
      addRecordFolder(base64UrlEncode(sffr.recordUid), base64UrlEncode(sffr.folderUid));
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

function sanitizeFolderName(name: string): string {
  return name.replaceAll("\\", "-").replaceAll("/", "-");
}

function joinPath(parent: string, child: string): string {
  return parent ? parent + "/" + child : child;
}
