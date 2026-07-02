import { mock } from "jest-mock-extended";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { FieldType, SecureNoteType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherType } from "@bitwarden/sdk-internal";

import { assertCustomFieldExists } from "../spec-data/importer-test-utils";
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
  const configService = mock<ConfigService>();

  beforeEach(() => {
    // By default, disable all feature flags
    configService.getFeatureFlag.mockResolvedValue(false);
  });

  it("should return error with missing root tag", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(InvalidRootNodeData);
    expect(result.errorMessage).toBe("Missing `passwordfile` node.");
  });

  it("should return error with invalid export version", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(InvalidVersionData);
    expect(result.errorMessage).toBe(
      "Unsupported export version detected - (only 17.0 is supported)",
    );
  });

  it("should return error if file is marked as encrypted", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(EncryptedFileData);
    expect(result.errorMessage).toBe("Encrypted Password Depot files are not supported.");
  });

  it("should return error with missing passwords node tag", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(MissingPasswordsNodeData);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Missing `passwordfile > passwords` node.");
  });

  it("should parse groups nodes into folders", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const folder = new FolderView();
    folder.name = "tempDB";

    const result = await importer.parse(PasswordTestData);
    expect(result.folders).toEqual([
      expect.objectContaining({
        id: "",
        name: "tempDB",
        revisionDate: expect.any(Date),
      }),
    ]);
  });

  it("should parse password type into logins", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(PasswordTestData);

    expect(result.ciphers.length).toEqual(3);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("password type");
    expect(cipher.notes).toBe("someComment");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.username).toBe("someUser");
    expect(cipher.login.password).toBe("p6J<]fmjv!:H&iJ7/Mwt@3i8");
    expect(cipher.login.uri).toBe("http://example.com");
  });

  it("should parse any unmapped fields as custom fields", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(PasswordTestData);

    expect(result.ciphers.length).toEqual(3);
    const cipher = result.ciphers[0];

    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.name).toBe("password type");

    expect(cipher.fields).not.toBeNull();
    // Custom field test cases of the form [fieldName, fieldValue, fieldType]
    const customFields: [string, string, FieldType | undefined][] = [
      ["lastmodified", "07.05.2025 13:37:56", FieldType.Text],
      ["expirydate", "07.05.2025", FieldType.Text],
      ["importance", "0", undefined],
      ["passwort", "password", FieldType.Hidden],
      ["memo", "memo", FieldType.Text],
      ["datum", new Date("2025-05-13T00:00:00Z").toLocaleDateString(), FieldType.Text],
      ["nummer", "1", FieldType.Text],
      ["boolean", "1", FieldType.Boolean],
      ["decimal", "1,01", FieldType.Text],
      ["email", "who@cares.com", FieldType.Text],
      ["url", "example.com", FieldType.Text],
    ];
    customFields.forEach(([name, value, type]) => {
      assertCustomFieldExists(cipher.fields, name, value, type);
    });
  });

  it("should parse credit cards", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(CreditCardTestData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
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
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(IdentityTestData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
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
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(RDPTestData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("rdp type");
    expect(cipher.notes).toBe("someNote");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.username).toBe("someUser");
    expect(cipher.login.password).toBe("somePassword");
    expect(cipher.login.uri).toBe("ms-rd:subscribe?url=https://contoso.com");
  });

  it("should parse software license into secure notes", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(SoftwareLicenseTestData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toBe("software-license type");
    expect(cipher.notes).toBe("someComment");

    expect(cipher.secureNote).not.toBeNull();
    expect(cipher.secureNote.type).toBe(SecureNoteType.Generic);

    // Custom field test cases of the form [fieldName, fieldValue]
    const customFields: [string, string][] = [
      ["IDS_LicenseProduct", "someProduct"],
      ["IDS_LicenseVersion", "someVersion"],
      ["IDS_LicenseName", "some User"],
      ["IDS_LicenseKey", "license-key"],
      ["IDS_LicenseAdditionalKey", "additional-license-key"],
      ["IDS_LicenseURL", "example.com"],
      ["IDS_LicenseProtected", "1"],
      ["IDS_LicenseUserName", "someUserName"],
      ["IDS_LicensePassword", "somePassword"],
      ["IDS_LicensePurchaseDate", new Date("2025-05-12T00:00:00Z").toLocaleDateString()],
      ["IDS_LicenseOrderNumber", "order number"],
      ["IDS_LicenseEmail", "someEmail"],
      ["IDS_LicenseExpires", "Nie"],
    ];
    customFields.forEach(([name, value]) => {
      assertCustomFieldExists(cipher.fields, name, value);
    });
  });

  it("should parse team viewer into login type", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(TeamViewerTestData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("TeamViewer type");
    expect(cipher.notes).toBe("someNote");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.password).toBe("somePassword");
    expect(cipher.login.username).toBe("");
    expect(cipher.login.uri).toBe("partnerId");

    assertCustomFieldExists(cipher.fields, "IDS_TeamViewerMode", "0");
  });

  it("should parse putty into login type", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(PuttyTestData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("Putty type");
    expect(cipher.notes).toBe("someNote");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.password).toBe("somePassword");
    expect(cipher.login.username).toBe("someUser");
    expect(cipher.login.uri).toBe("localhost");

    // Custom field test cases of the form [fieldName, fieldValue]
    const customFields: [string, string][] = [
      ["IDS_PuTTyProtocol", "0"],
      ["IDS_PuTTyKeyFile", "pathToKeyFile"],
      ["IDS_PuTTyKeyPassword", "passwordForKeyFile"],
      ["IDS_PuTTyPort", "8080"],
    ];
    customFields.forEach(([name, value]) => {
      assertCustomFieldExists(cipher.fields, name, value);
    });
  });

  describe("should parse banking item type into login type", () => {
    it("with new item types feature flag OFF", async () => {
      const importer = new PasswordDepot17XmlImporter(configService);
      const result = await importer.parse(BankingTestData);

      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];

      expect(cipher.type).toEqual(CipherType.Login);
      expect(cipher.name).toBe("banking type");
      expect(cipher.notes).toBe("someNote");

      expect(cipher.login).not.toBeNull();
      expect(cipher.login.password).toBe("somePassword");
      expect(cipher.login.username).toBe("someUser");
      expect(cipher.login.uri).toBe("http://some-bank.com");

      // Custom field test cases of the form [fieldName, fieldValue]
      const customFields: [string, string][] = [
        ["IDS_ECHolder", "account holder"],
        ["IDS_ECAccountNumber", "1234567890"],
        ["IDS_ECBLZ", "12345678"],
        ["IDS_ECBankName", "someBank"],
        ["IDS_ECBIC", "bic"],
        ["IDS_ECIBAN", "iban"],
        ["IDS_ECCardNumber", "12345678"],
        ["IDS_ECPhone", "0049"],
        ["IDS_ECLegitimacyID", "1234"],
        ["IDS_ECPIN", "123"],
        // TAN entries
        ["tan_1_value", "1234"],
        ["tan_1_used", "12.05.2025 15:10:54"],
        ["tan_1_amount", " 100,00"],
        ["tan_1_comment", "some TAN note"],
        ["tan_1_ccode", "123"],
        ["tan_2_value", "4321"],
        ["tan_2_amount", " 0,00"],
      ];
      customFields.forEach(([name, value]) => {
        assertCustomFieldExists(cipher.fields, name, value);
      });
    });

    it("with new item types feature flag ON", async () => {
      configService.getFeatureFlag.mockResolvedValueOnce(true);
      const importer = new PasswordDepot17XmlImporter(configService);
      const result = await importer.parse(BankingTestData);

      expect(result.ciphers.length).toEqual(2);
      const loginCipherIdx = result.ciphers.findIndex((c) => c.type === CipherType.Login);
      expect(loginCipherIdx).not.toEqual(-1);
      const bankAccountCipherIdx = result.ciphers.findIndex(
        (c) => c.type === CipherType.BankAccount,
      );
      expect(bankAccountCipherIdx).not.toEqual(-1);

      // Folders
      expect(result.folders.length).toEqual(1);
      expect(result.folderRelationships.length).toEqual(2);
      expect(result.folderRelationships[0]).toEqual([0, 0]);
      expect(result.folderRelationships[1]).toEqual([1, 0]);

      // Login Cipher
      const loginCipher = result.ciphers[loginCipherIdx];

      expect(loginCipher.type).toEqual(CipherType.Login);
      expect(loginCipher.name).toBe("banking type");
      expect(loginCipher.notes).toBe("someNote");

      expect(loginCipher.login).not.toBeNull();
      expect(loginCipher.login.password).toBe("somePassword");
      expect(loginCipher.login.username).toBe("someUser");
      expect(loginCipher.login.uri).toBe("http://some-bank.com");

      // Custom field test cases of the form [fieldName, fieldValue]
      const loginCipherCustomFields: [string, string][] = [
        ["IDS_ECBIC", "bic"],
        ["IDS_ECCardNumber", "12345678"],
        ["IDS_ECLegitimacyID", "1234"],
        // TAN entries
        ["tan_1_value", "1234"],
        ["tan_1_used", "12.05.2025 15:10:54"],
        ["tan_1_amount", " 100,00"],
        ["tan_1_comment", "some TAN note"],
        ["tan_1_ccode", "123"],
        ["tan_2_value", "4321"],
        ["tan_2_amount", " 0,00"],
      ];
      loginCipherCustomFields.forEach(([name, value]) => {
        assertCustomFieldExists(loginCipher.fields, name, value);
      });

      // Bank Account cipher
      const bankAccountCipher = result.ciphers[bankAccountCipherIdx];
      expect(bankAccountCipher.type).toEqual(CipherType.BankAccount);
      expect(bankAccountCipher.name).toBe("banking type");
      expect(bankAccountCipher.bankAccount.nameOnAccount).toEqual("account holder");
      expect(bankAccountCipher.bankAccount.accountNumber).toEqual("1234567890");
      expect(bankAccountCipher.bankAccount.routingNumber).toEqual("12345678");
      expect(bankAccountCipher.bankAccount.bankName).toEqual("someBank");
      expect(bankAccountCipher.bankAccount.iban).toEqual("iban");
      expect(bankAccountCipher.bankAccount.bankContactPhone).toEqual("0049");
      expect(bankAccountCipher.bankAccount.pin).toEqual("123");
      // All custom fields not specifically attached to the bank account
      // cipher are left as custom fields on the login cipher
      expect(bankAccountCipher.fields.length).toEqual(0);
    });
  });

  it("should parse information into secure note type", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(InformationTestData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toBe("information type");
    expect(cipher.notes).toBe("some note content");
  });

  it("should parse certificate into login type", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(CertificateTestData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("certificate type");
    expect(cipher.notes).toBe("someNote");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.password).toBe("somePassword");
  });

  it("should parse encrypted file into login type", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(EncryptedFileTestData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.Login);
    expect(cipher.name).toBe("encrypted file type");
    expect(cipher.notes).toBe("some comment");

    expect(cipher.login).not.toBeNull();
    expect(cipher.login.password).toBe("somePassword");
  });

  it("should parse document type into secure note", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(DocumentTestData);

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];

    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.name).toBe("document type");
    expect(cipher.notes).toBe("document comment");

    assertCustomFieldExists(cipher.fields, "IDS_DocumentSize", "27071");
    assertCustomFieldExists(cipher.fields, "IDS_DocumentFolder", "C:\\Users\\DJSMI\\Downloads\\");
    assertCustomFieldExists(
      cipher.fields,
      "IDS_DocumentFile",
      "C:\\Users\\DJSMI\\Downloads\\some.pdf",
    );
  });

  it("should parse favourites and set them on the target item", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    const result = await importer.parse(PasswordTestData);

    expect(result.ciphers.length).toEqual(3);
    let cipher = result.ciphers[0];
    expect(cipher.name).toBe("password type");
    expect(cipher.favorite).toBe(false);

    cipher = result.ciphers[1];
    expect(cipher.name).toBe("password type (2)");
    expect(cipher.favorite).toBe(true);

    cipher = result.ciphers[2];
    expect(cipher.name).toBe("password type (3)");
    expect(cipher.favorite).toBe(true);
  });

  it("should parse groups nodes into collections when importing into an organization", async () => {
    const importer = new PasswordDepot17XmlImporter(configService);
    importer.organizationId = "someOrgId" as OrganizationId;
    const collection = new CollectionView({
      name: "tempDB",
      organizationId: importer.organizationId,
      id: null as any,
    });
    const actual = [collection];

    const result = await importer.parse(PasswordTestData);
    expect(result.collections).toEqual(actual);
  });
});
