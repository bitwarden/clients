/**
 * This is a magic line that tricks Jest into adding subtle.crypto to the test environment.
 * @jest-environment node
 */
import { fromBinary } from "@bufbuild/protobuf";

import { Vault, base64UrlEncode } from "../../keeper/access";
import * as fixture from "../../spec-data/keeper-direct/sync-down-fixture.json";

import { RecordKeyType } from "./generated/record_pb";
import { SyncDownResponseSchema } from "./generated/sync-down_pb";
import { KeeperKey, VaultItem, VaultRecordErrorReason } from "./models";
import { encryptAesV2 } from "./services/crypto";

// Vault is a temporary data structure. It's only used to store the decoded vault data from the Keeper API response.
// Later it's converted to the ImportResult format by the keeper-direct-importer. We only do some minimal testing here
// to make sure it doesn't have any major issues with decryption and data access. The keeper-direct-importer.spec tests
// the conversion from Vault to ImportResult in more detail, since that's where most of the Bitwarden specific logic is.
describe("Keeper Vault", () => {
  let vault: Vault;

  beforeAll(async () => {
    const response = fromBinary(SyncDownResponseSchema, Buffer.from(fixture.response, "base64"));
    const masterKey = new Uint8Array(Buffer.from(fixture.masterKey, "base64"));
    vault = await (Vault as any).processMergedSyncDownPages(response, masterKey);
  });

  it("should decrypt all records", () => {
    expect(vault.getItems().length).toBe(40);
  });

  it("should decrypt login fields", () => {
    const record = findItem("Amazon Account");
    expect(record.type).toBe("login");
    expect(record.notes).toBe("Primary Amazon account for online shopping and Prime membership");
  });

  it("should decrypt notes", () => {
    const record = findItem("Important Meeting Notes");
    expect(record.notes).toBeTruthy();
  });

  it("should contain all record types", () => {
    const types = new Set(vault.getItems().map((r) => r.type));
    expect(types).toContain("login");
    expect(types).toContain("sshKeys");
    expect(types).toContain("address");
    expect(types).toContain("contact");
    expect(types).toContain("bankCard");
    expect(types).toContain("bankAccount");
    expect(types).toContain("databaseCredentials");
    expect(types).toContain("serverCredentials");
    expect(types).toContain("encryptedNotes");
    expect(types).toContain("membership");
    expect(types).toContain("passport");
    expect(types).toContain("softwareLicense");
    expect(types).toContain("birthCertificate");
    expect(types).toContain("driverLicense");
    expect(types).toContain("ssnCard");
    expect(types).toContain("healthInsurance");
    expect(types).toContain("photo");
    expect(types).toContain("file");
  });

  it("should build record folder paths", () => {
    expect(findItem("General Information Record").folders).toEqual([
      "Personal/Finance/Banking/Accounts",
    ]);
    expect(findItem("Production MySQL Database").folders).toEqual([
      "Development/Name-with-both-slashes/Name-with-forward-slashes",
      "Development/Name-with-both-slashes/Name-with-forward-slashes/Name-with-backslashes",
    ]);
    expect(findItem("Web Server - Production").folders).toEqual([
      "Development/Name-with-both-slashes/Android",
      "Clients/Enterprise/North America/TechCorp",
    ]);
    expect(findItem("Sensitive Login Credential").folders).toEqual(["Shared Project Folder"]);
    expect(findItem("VISA").folders).toEqual(["Marketing", "Marketing/Social Media/Cards"]);
    expect(findItem("GitHub").folders).toEqual(["Marketing", "Shared Project Folder"]);
    expect(findItem("Amazon Account").folders).toEqual(["Education"]);
  });

  //
  // Helpers
  //

  function findItem(title: string): VaultItem {
    return vault.getItems().find((i) => i.title === title)!;
  }
});

describe("Keeper Vault error production", () => {
  const validAesKey = new Uint8Array(32);

  describe("decryptRecords", () => {
    it("reports a version < 3 record as UnsupportedVersion and omits it from the map", async () => {
      const recordUid = new Uint8Array([1, 2, 3]);
      const uid = base64UrlEncode(recordUid);
      const keys = new Map([[uid, validAesKey]]);
      const records = [{ recordUid, version: 2, data: new Uint8Array() }];

      const [map, errors] = await (Vault as any).decryptRecords(records, keys);

      expect(map.has(uid)).toBe(false);
      expect(errors).toContainEqual({ id: uid, reason: VaultRecordErrorReason.UnsupportedVersion });
    });

    it("reports a record with no key as DecryptionFailed", async () => {
      const recordUid = new Uint8Array([4, 5, 6]);
      const uid = base64UrlEncode(recordUid);
      const records = [{ recordUid, version: 3, data: new Uint8Array() }];

      const [map, errors] = await (Vault as any).decryptRecords(records, new Map());

      expect(map.has(uid)).toBe(false);
      expect(errors).toContainEqual({ id: uid, reason: VaultRecordErrorReason.DecryptionFailed });
    });

    it("reports a record whose decryption throws as DecryptionFailed", async () => {
      const recordUid = new Uint8Array([7, 8, 9]);
      const uid = base64UrlEncode(recordUid);
      const keys = new Map([[uid, validAesKey]]);
      // Garbage ciphertext that cannot be decrypted with the key.
      const records = [{ recordUid, version: 3, data: new Uint8Array([1, 2, 3, 4]) }];

      const [map, errors] = await (Vault as any).decryptRecords(records, keys);

      expect(map.has(uid)).toBe(false);
      expect(errors).toContainEqual({ id: uid, reason: VaultRecordErrorReason.DecryptionFailed });
    });
  });

  describe("decryptRecordKeys", () => {
    it("does not throw when a record key cannot be decrypted, leaving the key absent", async () => {
      const recordUid = new Uint8Array([1]);
      const uid = base64UrlEncode(recordUid);
      const metaData = [
        { recordUid, recordKey: new Uint8Array(), recordKeyType: RecordKeyType.NO_KEY },
      ];

      const map = await (Vault as any).decryptRecordKeys(metaData, validAesKey);

      expect(map.has(uid)).toBe(false);
    });
  });

  describe("decryptFolderNames", () => {
    it("skips and reports a folder whose key cannot be decrypted", async () => {
      const folderUid = new Uint8Array([2]);
      const uid = base64UrlEncode(folderUid);
      const userFolders = [
        {
          folderUid,
          userFolderKey: new Uint8Array(),
          keyType: RecordKeyType.NO_KEY,
          data: new Uint8Array(),
        },
      ];

      const [map, errors] = await (Vault as any).decryptFolderNames(userFolders, validAesKey);

      expect(map.has(uid)).toBe(false);
      expect(errors).toEqual([{ id: uid, reason: VaultRecordErrorReason.FolderDecryptionFailed }]);
    });
  });

  describe("decryptSharedFolderNames", () => {
    it("skips and reports a shared folder with no key", async () => {
      const sharedFolderUid = new Uint8Array([3]);
      const uid = base64UrlEncode(sharedFolderUid);
      const sharedFolders = [{ sharedFolderUid, data: new Uint8Array(), name: new Uint8Array() }];

      const [map, errors] = await (Vault as any).decryptSharedFolderNames(sharedFolders, new Map());

      expect(map.has(uid)).toBe(false);
      expect(errors).toEqual([{ id: uid, reason: VaultRecordErrorReason.FolderDecryptionFailed }]);
    });
  });

  describe("decryptSharedFolderFolderNames", () => {
    it("skips and reports a subfolder whose parent shared folder key is missing", async () => {
      const sharedFolderUid = new Uint8Array([4]);
      const folderUid = new Uint8Array([5]);
      const uid = base64UrlEncode(folderUid);
      const sff = [
        {
          sharedFolderUid,
          folderUid,
          sharedFolderFolderKey: new Uint8Array(),
          keyType: RecordKeyType.NO_KEY,
          data: new Uint8Array(),
        },
      ];

      const [map, errors] = await (Vault as any).decryptSharedFolderFolderNames(sff, new Map());

      expect(map.has(uid)).toBe(false);
      expect(errors).toEqual([{ id: uid, reason: VaultRecordErrorReason.FolderDecryptionFailed }]);
    });
  });

  describe("decryptLinkedRecordKeys", () => {
    it("derives a child record key from the parent record key", async () => {
      const parentUid = new Uint8Array([10]);
      const childUid = new Uint8Array([11]);
      const parentKey = new Uint8Array(32).fill(7) as KeeperKey;
      const childKey = new Uint8Array(32).fill(9);

      // The link carries the child key encrypted with the parent key (AES-GCM, 60 bytes).
      const encryptedChildKey = await encryptAesV2(childKey, parentKey);
      const recordLinks = [
        { parentRecordUid: parentUid, childRecordUid: childUid, recordKey: encryptedChildKey },
      ];
      const knownKeys = new Map([[base64UrlEncode(parentUid), parentKey]]);

      const resolved = await (Vault as any).decryptLinkedRecordKeys(recordLinks, knownKeys);

      expect(resolved.get(base64UrlEncode(childUid))).toEqual(childKey);
    });

    it("resolves a chain where a child is the parent of another child", async () => {
      const rootUid = new Uint8Array([20]);
      const midUid = new Uint8Array([21]);
      const leafUid = new Uint8Array([22]);
      const rootKey = new Uint8Array(32).fill(1) as KeeperKey;
      const midKey = new Uint8Array(32).fill(2) as KeeperKey;
      const leafKey = new Uint8Array(32).fill(3);

      const encryptedMidKey = await encryptAesV2(midKey, rootKey);
      const encryptedLeafKey = await encryptAesV2(leafKey, midKey);
      // Leaf link is listed before the mid link to prove the fixpoint loop handles ordering.
      const recordLinks = [
        { parentRecordUid: midUid, childRecordUid: leafUid, recordKey: encryptedLeafKey },
        { parentRecordUid: rootUid, childRecordUid: midUid, recordKey: encryptedMidKey },
      ];
      const knownKeys = new Map([[base64UrlEncode(rootUid), rootKey]]);

      const resolved = await (Vault as any).decryptLinkedRecordKeys(recordLinks, knownKeys);

      expect(resolved.get(base64UrlEncode(midUid))).toEqual(midKey);
      expect(resolved.get(base64UrlEncode(leafUid))).toEqual(leafKey);
    });

    it("skips a link whose parent key is unavailable", async () => {
      const parentUid = new Uint8Array([30]);
      const childUid = new Uint8Array([31]);
      const recordLinks = [
        { parentRecordUid: parentUid, childRecordUid: childUid, recordKey: new Uint8Array(60) },
      ];

      const resolved = await (Vault as any).decryptLinkedRecordKeys(recordLinks, new Map());

      expect(resolved.has(base64UrlEncode(childUid))).toBe(false);
    });
  });
});
