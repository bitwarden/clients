/**
 * This is a magic line that tricks Jest into adding subtle.crypto to the test environment.
 * @jest-environment node
 */
import { Vault } from "../../keeper/access";

import { SyncDownResponse } from "./generated/SyncDown";
import * as fixture from "./keeper-vault-fixture.json";
import { VaultItem } from "./vault";

// Vault is a temporary data structure. It's only used to store the decoded vault data from the Keeper API response.
// Later it's converted to the ImportResult format by the keeper-direct-importer. We only do some minimal testing here
// to make sure it doesn't have any major issues with decryption and data access. The keeper-direct-importer.spec tests
// the conversion from Vault to ImportResult in more detail, since that's where most of the Bitwarden specific logic is.
describe("Keeper Vault", () => {
  let vault: Vault;

  beforeAll(async () => {
    const response = SyncDownResponse.fromBinary(Buffer.from(fixture.response, "base64"));
    const masterKey = new Uint8Array(Buffer.from(fixture.masterKey, "base64"));
    vault = await (Vault as any).processNew(response, masterKey);
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
