import { Ui } from "../../lastpass/access/ui";
import { Client, ClientOptions } from "./client";
import {
  base64UrlEncode,
  decryptAesV1,
  decryptAesV2,
  decryptFolderData,
  decryptKeeperKey,
  decryptRecordData,
} from "./crypto";
import {
  SharedFolder,
  SyncDownResponse,
  UserFolder,
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

type Decryptor = (data: Uint8Array, key: Uint8Array) => Promise<Uint8Array>;

export class Vault {
  static async open(username: string, password: string, options: ClientOptions): Promise<Vault> {
    const client = new Client(options);
    const loginResult = await client.login(username, password, options);
    // TODO: It seems we don't need this. Remove!
    await client.loadAccountSummary(loginResult.sessionToken);

    const pages = await client.syncDown(loginResult.sessionToken);
    const merged = Vault.mergeSyncDownPages(pages);
    return await Vault.processNew(merged, loginResult.dataKey);
  }

  getRecords(): RecordV3[] {
    return Array.from(this.records.values());
  }

  getFolders(): string[] {
    return Array.from(this.folders.values());
  }

  getSharedFolders(): string[] {
    return Array.from(this.sharedFolders.values());
  }

  getRecordFolderPaths(): Map<string, string> {
    return new Map<string, string>();
  }

  //
  // Private
  //

  private constructor(
    private readonly records: Map<string, RecordV3>,
    private readonly folders: Map<string, string>,
    private readonly sharedFolders: Map<string, string>,
  ) {}

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

    return new Vault(records, folders, sharedFolders);
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
