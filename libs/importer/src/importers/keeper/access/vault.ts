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

  private records = new Map<string, RecordV3>();
  private folders = new Map<string, string>();
  private sharedFolders = new Map<string, string>();

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
    const log = console.log;

    const folders = await Vault.decryptFolderNames(merged.userFolders, masterKey);
    const sharedFolders = await Vault.decryptSharedFolderNames(merged.sharedFolders, masterKey);
    const keys = await Vault.decryptRecordKeys(merged.recordMetaData, masterKey);
    const [decryptedRecords, failedRecords] = await Vault.decryptRecords(merged.records, keys);

    // TODO: Remove this debug code!
    if (0) {
      log("Records decrypted:", decryptedRecords.size);
      log("Records failed:", failedRecords.length);
      log("Keys total:", keys.size);
      for (const record of decryptedRecords.values()) {
        log(record);
      }
    }

    const vault = new Vault();
    vault.records = decryptedRecords;
    vault.folders = folders;
    vault.sharedFolders = sharedFolders;
    return vault;
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

  private static async decryptSharedFolderNames(
    sharedFolders: SharedFolder[],
    masterKey: Uint8Array,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const folder of sharedFolders) {
      const uid = base64UrlEncode(folder.sharedFolderUid);
      const folderKey = await decryptKeeperKey(folder.sharedFolderKey, folder.keyType, masterKey);
      const name = folder.data
        ? (await Vault.decryptJsonV1<{ name: string }>(folder.data, folderKey)).name
        : await Vault.decryptString(folder.name, folderKey, decryptAesV1);
      result.set(uid, name);
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
