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
  private constructor(
    private readonly dataKey: Uint8Array,
    public records: Map<string, VaultRecord>,
    public folders: Map<string, VaultFolder>,
    public sharedFolders: Map<string, VaultSharedFolder>,
  ) {}

  private async processSyncDownResponse(response: SyncDownResponse): Promise<void> {
    const dataKey = this.dataKey;

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
          dataKey,
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
          dataKey,
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
          dataKey,
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
  }

  static async open(username: string, password: string, options: ClientOptions): Promise<Vault> {
    const client = new Client(options);
    const loginResult = await client.login(username, password, options);
    await client.loadAccountSummary(loginResult.sessionToken);

    const records = new Map<string, VaultRecord>();
    const folders = new Map<string, VaultFolder>();
    const sharedFolders = new Map<string, VaultSharedFolder>();
    const vault = new Vault(loginResult.dataKey, records, folders, sharedFolders);
    const syncResponse = await client.syncDown(loginResult.sessionToken);
    await vault.processSyncDownResponse(syncResponse);

    return vault;
  }

  getRecords(): VaultRecord[] {
    return Array.from(this.records.values());
  }

  getRecord(uid: string): VaultRecord | undefined {
    return this.records.get(uid);
  }

  searchRecords(query: string): VaultRecord[] {
    const lowerQuery = query.toLowerCase();
    return this.getRecords().filter(
      (record) =>
        record.title.toLowerCase().includes(lowerQuery) ||
        record.login?.toLowerCase().includes(lowerQuery) ||
        record.url?.toLowerCase().includes(lowerQuery),
    );
  }

  getFolders(): VaultFolder[] {
    return Array.from(this.folders.values());
  }

  getFolder(uid: string): VaultFolder | undefined {
    return this.folders.get(uid);
  }

  getSharedFolders(): VaultSharedFolder[] {
    return Array.from(this.sharedFolders.values());
  }

  getSharedFolder(uid: string): VaultSharedFolder | undefined {
    return this.sharedFolders.get(uid);
  }

  getRecordsInFolder(folderUid: string): VaultRecord[] {
    return this.getRecords().filter(
      (record) =>
        record.sharedFolderUid === folderUid ||
        // TODO: Implement proper folder assignment
        false,
    );
  }
}
