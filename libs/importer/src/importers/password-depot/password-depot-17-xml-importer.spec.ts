import { CollectionView } from "@bitwarden/admin-console/common";
import { FieldType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherType } from "@bitwarden/sdk-internal";

import {
  EncryptedFileData,
  InvalidRootNodeData,
  InvalidVersionData,
  MissingPasswordsNodeData,
  PasswordTestData,
} from "../spec-data/password-depot-xml";

import { PasswordDepot17XmlImporter } from "./password-depot-17-xml-importer";

describe("Password Depot 17 Xml Importer", () => {
  it("should return error with missing root tag", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(InvalidRootNodeData);
    expect(result.errorMessage).toBe("Missing `passwordfile` node.");
  });

  it("should return error with invalid export version", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(InvalidVersionData);
    expect(result.errorMessage).toBe(
      "Unsupported export version detected - (only 17.0 is supported)",
    );
  });

  it("should return error if file is marked as encrypted", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(EncryptedFileData);
    expect(result.errorMessage).toBe("Encrypted Password Depot files are not supported.");
  });

  it("should return error with missing passwords node tag", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(MissingPasswordsNodeData);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Missing `passwordfile > passwords` node.");
  });

  it("should parse groups nodes into folders", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const folder = new FolderView();
    folder.name = "tempDB";
    const actual = [folder];

    const result = await importer.parse(PasswordTestData);
    expect(result.folders).toEqual(actual);
  });

  it("should parse password type into logins", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(PasswordTestData);

    const cipher = result.ciphers.shift();

    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.name).toBe("password type");
    expect(cipher.notes).toBe("someComment");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.username).toBe("someUser");
    expect(cipher.login.password).toBe("p6J<]fmjv!:H&iJ7/Mwt@3i8");
    expect(cipher.login.uri).toBe("http://example.com");
  });

  it("should parse any unmapped fields as custom fields", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(PasswordTestData);

    const cipher = result.ciphers.shift();

    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.name).toBe("password type");

    expect(cipher.fields).not.toBeNull();

    expect(cipher.fields[0].name).toBe("lastmodified");
    expect(cipher.fields[0].value).toBe("07.05.2025 13:37:56");
    expect(cipher.fields[0].type).toBe(FieldType.Text);

    expect(cipher.fields[1].name).toBe("expirydate");
    expect(cipher.fields[1].value).toBe("07.05.2025");
    expect(cipher.fields[0].type).toBe(FieldType.Text);

    expect(cipher.fields[2].name).toBe("importance");
    expect(cipher.fields[2].value).toBe("0");
  });

  it("should parse groups nodes into collections when importing into an organization", async () => {
    const importer = new PasswordDepot17XmlImporter();
    importer.organizationId = "someOrgId";
    const collection = new CollectionView();
    collection.name = "tempDB";
    const actual = [collection];

    const result = await importer.parse(PasswordTestData);
    expect(result.collections).toEqual(actual);
  });
});
