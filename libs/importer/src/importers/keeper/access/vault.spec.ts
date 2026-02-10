/**
 * This is a magic line that tricks Jest into adding subtle.crypto to the test environment.
 * @jest-environment node
 */
import { Vault } from "../../keeper/access";

import { SyncDownResponse } from "./generated/SyncDown";
import * as fixture from "./keeper-vault-fixture.json";

// Vault is a temporary data structure. It's only used to store the decoded vault data from the Keeper API response.
// Later it's converted to the ImportResult format by the keeper-direct-importer. We only do some minimal testing here
// to make sure it doesn't have any major issues with decryption and data access. The keeper-direct-importer.spec tests
// the conversion from Vault to ImportResult in more detail, since that's where most of the Bitwarden specific logic is.
describe("Keeper Vault", () => {
  let vault: Vault;

  beforeAll(async () => {
    const response = SyncDownResponse.fromBinary(Buffer.from(fixture.response, "base64"));
    vault = new (Vault as any)(new Uint8Array(Buffer.from(fixture.masterKey, "base64")));
    await (vault as any).processMergedSyncDownResponse(response);
  });

  it("should decrypt records, folders, and shared folders", () => {
    expect(vault.getRecords().length).toBe(78);
    expect(vault.getFolders().length).toBe(8);
    expect(vault.getSharedFolders().length).toBe(9);
  });

  it("should decrypt login fields", () => {
    const record = vault.getRecords().find((r) => r.title === "Amazon Sign-In")!;
    expect(record.type).toBe("login");
    expect(record.login).toBe("dflinn@bitwarden.com");
    expect(record.password).toBe("sSd{..Lj34+s,9F}Q(1S");
    expect(record.url).toBe("https://www.amazon.com/ap/signin");
  });

  it("should decrypt notes", () => {
    const record = vault.getRecords().find((r) => r.title === "cipher item")!;
    expect(record.notes).toBe("the quick brown fox jumps over the lazy dog.");
  });

  it("should contain all record types", () => {
    const types = new Set(vault.getRecords().map((r) => r.type));
    expect(types).toContain("login");
    expect(types).toContain("sshKeys");
    expect(types).toContain("address");
    expect(types).toContain("contact");
    expect(types).toContain("bankCard");
  });

  it("should assign shared folder UIDs to shared records", () => {
    const record = vault.getRecords().find((r) => r.title === "Sensitive Login Credential")!;
    expect(record.sharedFolderUid).toBeTruthy();
  });
});
