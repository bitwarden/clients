// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { FieldType, SecureNoteType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherType } from "@bitwarden/sdk-internal";

import {
  EncryptedFileData,
  InvalidRootNodeData,
  InvalidVersionData,
  CreditCardTestData,
  MissingPasswordsNodeData,
  PasswordTestData,
  IdentityTestData,
  RDPTestData,
  SoftwareLicenseTestData,
  TeamViewerTestData,
  PuttyTestData,
  BankingTestData,
  InformationTestData,
  CertificateTestData,
  EncryptedFileTestData,
  DocumentTestData,
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

    expect(cipher.type).toEqual(CipherType.Login);
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

    let customField = cipher.fields.find((f) => f.name === "passwort");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("password");
    expect(customField.type).toEqual(FieldType.Hidden);

    customField = cipher.fields.find((f) => f.name === "memo");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("memo");
    expect(customField.type).toEqual(FieldType.Text);

    customField = cipher.fields.find((f) => f.name === "datum");
    expect(customField).toBeDefined();
    const expectedDate = new Date("2025-05-13T00:00:00Z");
    expect(customField.value).toEqual(expectedDate.toLocaleDateString());
    expect(customField.type).toEqual(FieldType.Text);

    customField = cipher.fields.find((f) => f.name === "nummer");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("1");
    expect(customField.type).toEqual(FieldType.Text);

    customField = cipher.fields.find((f) => f.name === "boolean");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("1");
    expect(customField.type).toEqual(FieldType.Boolean);

    customField = cipher.fields.find((f) => f.name === "decimal");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("1,01");
    expect(customField.type).toEqual(FieldType.Text);

    customField = cipher.fields.find((f) => f.name === "email");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("who@cares.com");
    expect(customField.type).toEqual(FieldType.Text);

    customField = cipher.fields.find((f) => f.name === "url");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("example.com");
    expect(customField.type).toEqual(FieldType.Text);
  });

  it("should parse credit cards", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(CreditCardTestData);

    const cipher = result.ciphers.shift();
    expect(cipher.name).toBe("some CreditCard");
    expect(cipher.notes).toBe("someComment");

    expect(cipher.card).not.toBeNull();

    expect(cipher.card.cardholderName).toBe("some CC holder");
    expect(cipher.card.number).toBe("4222422242224222");
    expect(cipher.card.brand).toBe("Visa");
    expect(cipher.card.expMonth).toBe("5");
    expect(cipher.card.expYear).toBe("2026");
    expect(cipher.card.code).toBe("123");
  });

  it("should parse identity type", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(IdentityTestData);

    const cipher = result.ciphers.shift();
    expect(cipher.name).toBe("identity type");
    expect(cipher.notes).toBe("someNote");

    expect(cipher.identity).not.toBeNull();

    expect(cipher.identity.firstName).toBe("firstName");
    expect(cipher.identity.lastName).toBe("surName");
    expect(cipher.identity.email).toBe("email");
    expect(cipher.identity.company).toBe("someCompany");
    expect(cipher.identity.address1).toBe("someStreet");
    expect(cipher.identity.address2).toBe("address 2");
    expect(cipher.identity.city).toBe("town");
    expect(cipher.identity.state).toBe("state");
    expect(cipher.identity.postalCode).toBe("zipCode");
    expect(cipher.identity.country).toBe("country");
    expect(cipher.identity.phone).toBe("phoneNumber");
  });

  it("should parse RDP type", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(RDPTestData);

    const cipher = result.ciphers.shift();
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("rdp type");
    expect(cipher.notes).toBe("someNote");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.username).toBe("someUser");
    expect(cipher.login.password).toBe("somePassword");
    expect(cipher.login.uri).toBe("ms-rd:subscribe?url=https://contoso.com");
  });

  it("should parse software license into secure notes", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(SoftwareLicenseTestData);

    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toBe("software-license type");
    expect(cipher.notes).toBe("someComment");

    expect(cipher.secureNote).not.toBeNull();
    expect(cipher.secureNote.type).toBe(SecureNoteType.Generic);

    let customField = cipher.fields.find((f) => f.name === "IDS_LicenseProduct");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("someProduct");

    customField = cipher.fields.find((f) => f.name === "IDS_LicenseVersion");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("someVersion");

    customField = cipher.fields.find((f) => f.name === "IDS_LicenseName");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("some User");

    customField = cipher.fields.find((f) => f.name === "IDS_LicenseKey");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("license-key");

    customField = cipher.fields.find((f) => f.name === "IDS_LicenseAdditionalKey");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("additional-license-key");

    customField = cipher.fields.find((f) => f.name === "IDS_LicenseURL");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("example.com");

    customField = cipher.fields.find((f) => f.name === "IDS_LicenseProtected");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("1");

    customField = cipher.fields.find((f) => f.name === "IDS_LicenseUserName");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("someUserName");

    customField = cipher.fields.find((f) => f.name === "IDS_LicensePassword");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("somePassword");

    customField = cipher.fields.find((f) => f.name === "IDS_LicensePurchaseDate");
    expect(customField).toBeDefined();
    const expectedDate = new Date("2025-05-12T00:00:00Z");
    expect(customField.value).toEqual(expectedDate.toLocaleDateString());

    customField = cipher.fields.find((f) => f.name === "IDS_LicenseOrderNumber");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("order number");

    customField = cipher.fields.find((f) => f.name === "IDS_LicenseEmail");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("someEmail");

    customField = cipher.fields.find((f) => f.name === "IDS_LicenseExpires");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("Nie");
  });

  it("should parse team viewer into login type", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(TeamViewerTestData);

    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("TeamViewer type");
    expect(cipher.notes).toBe("someNote");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.password).toBe("somePassword");
    expect(cipher.login.username).toBe("");
    expect(cipher.login.uri).toBe("partnerId");

    const customField = cipher.fields.find((f) => f.name === "IDS_TeamViewerMode");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("0");
  });

  it("should parse putty into login type", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(PuttyTestData);

    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("Putty type");
    expect(cipher.notes).toBe("someNote");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.password).toBe("somePassword");
    expect(cipher.login.username).toBe("someUser");
    expect(cipher.login.uri).toBe("localhost");

    let customField = cipher.fields.find((f) => f.name === "IDS_PuTTyProtocol");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("0");

    customField = cipher.fields.find((f) => f.name === "IDS_PuTTyKeyFile");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("pathToKeyFile");

    customField = cipher.fields.find((f) => f.name === "IDS_PuTTyKeyPassword");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("passwordForKeyFile");

    customField = cipher.fields.find((f) => f.name === "IDS_PuTTyPort");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("8080");
  });

  it("should parse banking item type into login type", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(BankingTestData);

    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("banking type");
    expect(cipher.notes).toBe("someNote");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.password).toBe("somePassword");
    expect(cipher.login.username).toBe("someUser");
    expect(cipher.login.uri).toBe("http://some-bank.com");

    let customField = cipher.fields.find((f) => f.name === "IDS_ECHolder");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("account holder");

    customField = cipher.fields.find((f) => f.name === "IDS_ECAccountNumber");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("1234567890");

    customField = cipher.fields.find((f) => f.name === "IDS_ECBLZ");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("12345678");

    customField = cipher.fields.find((f) => f.name === "IDS_ECBankName");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("someBank");

    customField = cipher.fields.find((f) => f.name === "IDS_ECBIC");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("bic");

    customField = cipher.fields.find((f) => f.name === "IDS_ECIBAN");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("iban");

    customField = cipher.fields.find((f) => f.name === "IDS_ECCardNumber");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("12345678");

    customField = cipher.fields.find((f) => f.name === "IDS_ECPhone");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("0049");

    customField = cipher.fields.find((f) => f.name === "IDS_ECLegitimacyID");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("1234");

    customField = cipher.fields.find((f) => f.name === "IDS_ECPIN");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("123");

    customField = cipher.fields.find((f) => f.name === "tan_1_value");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("1234");

    customField = cipher.fields.find((f) => f.name === "tan_1_used");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("12.05.2025 15:10:54");

    // TAN entries
    customField = cipher.fields.find((f) => f.name === "tan_1_amount");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual(" 100,00");

    customField = cipher.fields.find((f) => f.name === "tan_1_comment");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("some TAN note");

    customField = cipher.fields.find((f) => f.name === "tan_1_ccode");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("123");

    customField = cipher.fields.find((f) => f.name === "tan_2_value");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("4321");

    customField = cipher.fields.find((f) => f.name === "tan_2_amount");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual(" 0,00");
  });

  it("should parse information into secure note type", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(InformationTestData);

    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toBe("information type");
    expect(cipher.notes).toBe("some note content");
  });

  it("should parse certificate into login type", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(CertificateTestData);

    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("certificate type");
    expect(cipher.notes).toBe("someNote");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.password).toBe("somePassword");
  });

  it("should parse encrypted file into login type", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(EncryptedFileTestData);

    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("encrypted file type");
    expect(cipher.notes).toBe("some comment");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.password).toBe("somePassword");
  });

  it("should parse document type into secure note", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(DocumentTestData);

    const cipher = result.ciphers.shift();

    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toBe("document type");
    expect(cipher.notes).toBe("document comment");

    let customField = cipher.fields.find((f) => f.name === "IDS_DocumentSize");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("27071");

    customField = cipher.fields.find((f) => f.name === "IDS_DocumentFolder");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("C:\\Users\\DJSMI\\Downloads\\");

    customField = cipher.fields.find((f) => f.name === "IDS_DocumentFile");
    expect(customField).toBeDefined();
    expect(customField.value).toEqual("C:\\Users\\DJSMI\\Downloads\\some.pdf");
  });

  it("should parse favourites and set them on the target item", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(PasswordTestData);

    let cipher = result.ciphers.shift();
    expect(cipher.name).toBe("password type");
    expect(cipher.favorite).toBe(false);

    cipher = result.ciphers.shift();
    expect(cipher.name).toBe("password type (2)");
    expect(cipher.favorite).toBe(true);

    cipher = result.ciphers.shift();
    expect(cipher.name).toBe("password type (3)");
    expect(cipher.favorite).toBe(true);
  });

  it("should parse groups nodes into collections when importing into an organization", async () => {
    const importer = new PasswordDepot17XmlImporter();
    importer.organizationId = "someOrgId" as OrganizationId;
    const collection = new CollectionView({
      name: "tempDB",
      organizationId: importer.organizationId,
      id: null,
    });
    const actual = [collection];

    const result = await importer.parse(PasswordTestData);
    expect(result.collections).toEqual(actual);
  });
});
