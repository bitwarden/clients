import { Client, ClientOptions } from "./client";
import {
  base64UrlEncode,
  decryptAesV1,
  decryptAesV2,
  decryptFolderData,
  decryptKeeperKey,
  decryptRecordData,
} from "./crypto";
import { SyncDownResponse } from "./generated/SyncDown";

export interface VaultField {
  type: string;
  label?: string;
  value: unknown[];
}

export interface VaultRecord {
  uid: string;
  title: string;
  login?: string;
  password?: string;
  url?: string;
  notes?: string;
  type: string;
  revision: number;
  sharedFolderUid?: string;
  fields: VaultField[];
  customFields: VaultField[];
}

export interface VaultFolder {
  uid: string;
  name: string;
  parentUid?: string;
  type: string;
}

export interface VaultSharedFolder {
  uid: string;
  name: string;
  owner?: string;
}

// V2 (legacy) record data format
interface DecryptedRecordDataV2 {
  title?: string;
  login?: string;
  password?: string;
  login_url?: string;
  notes?: string;
  type?: string;
}

// V3 record data format
interface RecordField {
  type: string;
  value: unknown[];
  label?: string;
}

interface DecryptedRecordDataV3 {
  title?: string;
  type?: string;
  fields?: RecordField[];
  custom?: RecordField[];
  notes?: string;
}

type DecryptedRecordData = DecryptedRecordDataV2 | DecryptedRecordDataV3;

interface DecryptedFolderData {
  name?: string;
  type?: string;
}

export class Vault {
  static async open(username: string, password: string, options: ClientOptions): Promise<Vault> {
    const client = new Client(options);
    const loginResult = await client.login(username, password, options);
    await client.loadAccountSummary(loginResult.sessionToken);

    const vault = new Vault(loginResult.dataKey);
    const pages = await client.syncDown(loginResult.sessionToken);
    const merged = Vault.mergeSyncDownPages(pages);
    await vault.processMergedSyncDownResponse(merged);

    return vault;
  }

  getRecords(): VaultRecord[] {
    return Array.from(this.records.values());
  }

  getFolders(): VaultFolder[] {
    return Array.from(this.folders.values());
  }

  getSharedFolders(): VaultSharedFolder[] {
    return Array.from(this.sharedFolders.values());
  }

  getRecordFolderPaths(): Map<string, string[]> {
    return this.recordFolderPaths;
  }

  //
  // Private
  //

  private readonly records = new Map<string, VaultRecord>();
  private readonly folders = new Map<string, VaultFolder>();
  private readonly sharedFolders = new Map<string, VaultSharedFolder>();
  private readonly sharedFolderSubfolders = new Map<
    string,
    { uid: string; name: string; parentUid?: string; sharedFolderUid: string }
  >();
  private readonly recordFolderPaths = new Map<string, string[]>();

  private constructor(private readonly masterKey: Uint8Array) {}

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

  private async processMergedSyncDownResponse(response: SyncDownResponse): Promise<void> {
    const masterKey = this.masterKey;

    const recordMetaMap = new Map<
      string,
      { recordKey: Uint8Array; version: number; sharedFolderUid?: string }
    >();
    for (const metadata of response.recordMetaData) {
      const uid = base64UrlEncode(new Uint8Array(metadata.recordUid));
      try {
        const recordKey = await decryptKeeperKey(
          new Uint8Array(metadata.recordKey),
          metadata.recordKeyType,
          masterKey,
        );
        recordMetaMap.set(uid, { recordKey, version: 0 }); // Version will be updated from Record
      } catch {
        // Failed to decrypt key for record
      }
    }

    const folderKeyMap = new Map<string, Uint8Array>();
    for (const folder of response.userFolders) {
      const uid = base64UrlEncode(new Uint8Array(folder.folderUid));
      try {
        const folderKey = await decryptKeeperKey(
          new Uint8Array(folder.userFolderKey),
          folder.keyType,
          masterKey,
        );
        folderKeyMap.set(uid, folderKey);
      } catch {
        // Failed to decrypt key for folder
      }
    }

    for (const folder of response.userFolders) {
      const uid = base64UrlEncode(new Uint8Array(folder.folderUid));
      const folderKey = folderKeyMap.get(uid);
      if (!folderKey) {
        continue;
      }

      try {
        const data = (await decryptFolderData(
          new Uint8Array(folder.data),
          folderKey,
        )) as DecryptedFolderData;

        const vaultFolder: VaultFolder = {
          uid,
          name: data.name ?? "",
          parentUid:
            folder.parentUid.length > 0
              ? base64UrlEncode(new Uint8Array(folder.parentUid))
              : undefined,
          type: data.type ?? "user_folder",
        };

        this.folders.set(uid, vaultFolder);
      } catch {
        // Failed to decrypt folder
      }
    }

    // Process shared folders
    const sharedFolderKeyMap = new Map<string, Uint8Array>();
    for (const sf of response.sharedFolders) {
      const uid = base64UrlEncode(new Uint8Array(sf.sharedFolderUid));
      try {
        const sfKey = await decryptKeeperKey(
          new Uint8Array(sf.sharedFolderKey),
          sf.keyType,
          masterKey,
        );
        sharedFolderKeyMap.set(uid, sfKey);

        // Decrypt shared folder name
        let name = "";
        if (sf.name && sf.name.length > 0) {
          const decryptedName = await decryptAesV1(new Uint8Array(sf.name), sfKey);
          name = new TextDecoder().decode(decryptedName);
        } else if (sf.data && sf.data.length > 0) {
          const decryptedData = await decryptAesV1(new Uint8Array(sf.data), sfKey);
          const sfData = JSON.parse(new TextDecoder().decode(decryptedData));
          name = sfData.name ?? "";
        }

        const sharedFolder: VaultSharedFolder = {
          uid,
          name,
          owner: sf.owner || undefined,
        };
        this.sharedFolders.set(uid, sharedFolder);
      } catch {
        // Failed to decrypt shared folder
      }
    }

    // Process shared folder subfolders
    for (const sff of response.sharedFolderFolders) {
      const sfUid = base64UrlEncode(new Uint8Array(sff.sharedFolderUid));
      const folderUid = base64UrlEncode(new Uint8Array(sff.folderUid));
      const sfKey = sharedFolderKeyMap.get(sfUid);
      if (!sfKey) {
        continue;
      }

      try {
        const folderKey = await decryptKeeperKey(
          new Uint8Array(sff.sharedFolderFolderKey),
          sff.keyType,
          sfKey,
        );
        const data = (await decryptFolderData(
          new Uint8Array(sff.data),
          folderKey,
        )) as DecryptedFolderData;

        const parentUid =
          sff.parentUid.length > 0 ? base64UrlEncode(new Uint8Array(sff.parentUid)) : undefined;

        this.sharedFolderSubfolders.set(folderUid, {
          uid: folderUid,
          name: data.name ?? "",
          parentUid,
          sharedFolderUid: sfUid,
        });
      } catch {
        // Failed to decrypt shared folder subfolder
      }
    }

    // Process shared folder records - add their keys to recordMetaMap
    for (const sfr of response.sharedFolderRecords) {
      const sfUid = base64UrlEncode(new Uint8Array(sfr.sharedFolderUid));
      const recordUid = base64UrlEncode(new Uint8Array(sfr.recordUid));
      const sfKey = sharedFolderKeyMap.get(sfUid);

      if (!sfKey) {
        continue;
      }

      try {
        const encryptedKey = new Uint8Array(sfr.recordKey);
        // Determine encryption type by key length (60 bytes = AES-GCM, otherwise AES-CBC)
        const recordKey =
          encryptedKey.length === 60
            ? await decryptAesV2(encryptedKey, sfKey)
            : await decryptAesV1(encryptedKey, sfKey);

        recordMetaMap.set(recordUid, { recordKey, version: 0, sharedFolderUid: sfUid });
      } catch {
        // Failed to decrypt shared folder record key
      }
    }

    // Now process records (including shared folder records)
    for (const record of response.records) {
      const uid = base64UrlEncode(new Uint8Array(record.recordUid));
      const meta = recordMetaMap.get(uid);
      if (!meta) {
        continue;
      }

      try {
        meta.version = record.version;
        const data = (await decryptRecordData(
          new Uint8Array(record.data),
          meta.recordKey,
          record.version,
        )) as DecryptedRecordData;

        let login = "";
        let password = "";
        let url = "";
        const notes = data.notes ?? "";
        let fields: VaultField[] = [];
        let customFields: VaultField[] = [];

        if (record.version >= 3 && "fields" in data && data.fields) {
          // V3 record: extract from fields array
          const getFieldValue = (type: string): string => {
            const field = data.fields?.find((f) => f.type === type);
            const val = field?.value?.[0];
            return typeof val === "string" ? val : "";
          };
          login = getFieldValue("login");
          password = getFieldValue("password");
          url = getFieldValue("url");

          // Store all fields
          fields = data.fields.map((f) => ({
            type: f.type,
            label: f.label,
            value: f.value ?? [],
          }));

          // Store custom fields
          if (data.custom) {
            customFields = data.custom.map((f) => ({
              type: f.type,
              label: f.label,
              value: f.value ?? [],
            }));
          }
        } else {
          // V2 record: direct properties
          const v2Data = data as DecryptedRecordDataV2;
          login = v2Data.login ?? "";
          password = v2Data.password ?? "";
          url = v2Data.login_url ?? "";
        }

        const vaultRecord: VaultRecord = {
          uid,
          title: data.title ?? "",
          login,
          password,
          url,
          notes,
          type: data.type ?? "login",
          revision: Number(record.revision),
          sharedFolderUid: meta.sharedFolderUid,
          fields,
          customFields,
        };

        this.records.set(uid, vaultRecord);
      } catch {
        // Failed to decrypt record
      }
    }

    this.buildRecordFolderPaths(response);
  }

  private buildRecordFolderPaths(response: SyncDownResponse): void {
    // Map shared folder UID -> user folder UID (where the SF is placed in the folder tree)
    const sharedFolderToUserFolder = new Map<string, string>();
    for (const ufsf of response.userFolderSharedFolders) {
      const folderUid =
        ufsf.folderUid.length > 0 ? base64UrlEncode(new Uint8Array(ufsf.folderUid)) : undefined;
      const sfUid = base64UrlEncode(new Uint8Array(ufsf.sharedFolderUid));
      if (folderUid) {
        sharedFolderToUserFolder.set(sfUid, folderUid);
      }
    }

    const pathCache = new Map<string, string>();

    const buildUserFolderPath = (folderUid: string): string => {
      const cached = pathCache.get(folderUid);
      if (cached !== undefined) {
        return cached;
      }

      const folder = this.folders.get(folderUid);
      if (!folder) {
        return "";
      }

      const name = sanitizeFolderName(folder.name);
      const path = folder.parentUid ? joinPath(buildUserFolderPath(folder.parentUid), name) : name;

      pathCache.set(folderUid, path);
      return path;
    };

    const buildSharedFolderBasePath = (sfUid: string): string => {
      const cached = pathCache.get("sf:" + sfUid);
      if (cached !== undefined) {
        return cached;
      }

      const sf = this.sharedFolders.get(sfUid);
      if (!sf) {
        return "";
      }

      const name = sanitizeFolderName(sf.name);
      const userFolderUid = sharedFolderToUserFolder.get(sfUid);
      const path = userFolderUid ? joinPath(buildUserFolderPath(userFolderUid), name) : name;

      pathCache.set("sf:" + sfUid, path);
      return path;
    };

    const buildSfSubfolderPath = (folderUid: string): string => {
      const cached = pathCache.get("sff:" + folderUid);
      if (cached !== undefined) {
        return cached;
      }

      const subfolder = this.sharedFolderSubfolders.get(folderUid);
      if (!subfolder) {
        return "";
      }

      const name = sanitizeFolderName(subfolder.name);
      const basePath = subfolder.parentUid
        ? buildSfSubfolderPath(subfolder.parentUid)
        : buildSharedFolderBasePath(subfolder.sharedFolderUid);
      const path = joinPath(basePath, name);

      pathCache.set("sff:" + folderUid, path);
      return path;
    };

    const addRecordPath = (recordUid: string, path: string) => {
      if (!path) {
        return;
      }
      let paths = this.recordFolderPaths.get(recordUid);
      if (!paths) {
        paths = [];
        this.recordFolderPaths.set(recordUid, paths);
      }
      if (!paths.includes(path)) {
        paths.push(path);
      }
    };

    // Records in personal folders
    for (const ufr of response.userFolderRecords) {
      const folderUid =
        ufr.folderUid.length > 0 ? base64UrlEncode(new Uint8Array(ufr.folderUid)) : undefined;
      const recordUid = base64UrlEncode(new Uint8Array(ufr.recordUid));
      if (folderUid) {
        addRecordPath(recordUid, buildUserFolderPath(folderUid));
      }
    }

    // Records in shared folders (direct or via subfolders)
    for (const sffr of response.sharedFolderFolderRecords) {
      const sfUid = base64UrlEncode(new Uint8Array(sffr.sharedFolderUid));
      const recordUid = base64UrlEncode(new Uint8Array(sffr.recordUid));
      const folderUid =
        sffr.folderUid.length > 0 ? base64UrlEncode(new Uint8Array(sffr.folderUid)) : undefined;

      if (folderUid) {
        addRecordPath(recordUid, buildSfSubfolderPath(folderUid));
      } else {
        addRecordPath(recordUid, buildSharedFolderBasePath(sfUid));
      }
    }

    // Records directly in shared folders (not in subfolders)
    for (const sfr of response.sharedFolderRecords) {
      const sfUid = base64UrlEncode(new Uint8Array(sfr.sharedFolderUid));
      const recordUid = base64UrlEncode(new Uint8Array(sfr.recordUid));
      addRecordPath(recordUid, buildSharedFolderBasePath(sfUid));
    }
  }
}

function sanitizeFolderName(name: string): string {
  return name.replaceAll("\\", "-").replaceAll("/", "-");
}

function joinPath(parent: string, child: string): string {
  return parent ? parent + "/" + child : child;
}
