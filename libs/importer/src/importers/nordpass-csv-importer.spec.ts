import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SecureNoteType, CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";

import { NordPassCsvImporter } from "./nordpass-csv-importer";
import { data as creditCardData } from "./spec-data/nordpass-csv/nordpass.card.csv";
import { data as identityData } from "./spec-data/nordpass-csv/nordpass.identity.csv";
import { data as loginDataWithAdditionalUrls } from "./spec-data/nordpass-csv/nordpass.login-with-additinal-urls.csv";
import { data as loginData } from "./spec-data/nordpass-csv/nordpass.login.csv";
import { data as secureNoteData } from "./spec-data/nordpass-csv/nordpass.secure-note.csv";

const namesTestData = [
  {
    title: "Given #fullName should set firstName",
    fullName: "MyFirstName",
    expected: Object.assign(new IdentityView(), {
      firstName: "MyFirstName",
      middleName: null,
      lastName: null,
    }),
  },
  {
    title: "Given #fullName should set first- and lastName",
    fullName: "MyFirstName MyLastName",
    expected: Object.assign(new IdentityView(), {
      firstName: "MyFirstName",
      middleName: null,
      lastName: "MyLastName",
    }),
  },
  {
    title: "Given #fullName should set first-, middle and lastName",
    fullName: "MyFirstName MyMiddleName MyLastName",
    expected: Object.assign(new IdentityView(), {
      firstName: "MyFirstName",
      middleName: "MyMiddleName",
      lastName: "MyLastName",
    }),
  },
  {
    title: "Given #fullName should set first-, middle and lastName with Jr",
    fullName: "MyFirstName MyMiddleName MyLastName Jr",
    expected: Object.assign(new IdentityView(), {
      firstName: "MyFirstName",
      middleName: "MyMiddleName",
      lastName: "MyLastName Jr",
    }),
  },
  {
    title: "Given #fullName should set first-, middle and lastName with Jr and III",
    fullName: "MyFirstName MyMiddleName MyLastName Jr III",
    expected: Object.assign(new IdentityView(), {
      firstName: "MyFirstName",
      middleName: "MyMiddleName",
      lastName: "MyLastName Jr III",
    }),
  },
];

function expectLogin(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Login);

  expect(cipher.name).toBe("SomeVaultItemName");
  expect(cipher.notes).toBe("Some note for the VaultItem");
  expect(cipher.login.uri).toBe("https://example.com");
  expect(cipher.login.uris.length).toBe(1);
  expect(cipher.login.uris[0].uri).toBe("https://example.com");
  expect(cipher.login.username).toBe("hello@bitwarden.com");
  expect(cipher.login.password).toBe("someStrongPassword");
}

function expectLoginWithAdditionalUrls(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Login);

  expect(cipher.name).toBe("SomeVaultItemName");
  expect(cipher.notes).toBe("Some note for the VaultItem");
  expect(cipher.login.uri).toBe("https://example.com");
  expect(cipher.login.uris.length).toBe(2);
  expect(cipher.login.uris[0].uri).toBe("https://example.com");
  expect(cipher.login.uris[1].uri).toBe("https://example.net");
  expect(cipher.login.username).toBe("hello@bitwarden.com");
  expect(cipher.login.password).toBe("someStrongPassword");
}

function expectCreditCard(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Card);

  expect(cipher.name).toBe("SomeVisa");
  expect(cipher.card.brand).toBe("Visa");
  expect(cipher.card.cardholderName).toBe("SomeHolder");
  expect(cipher.card.number).toBe("4024007103939509");
  expect(cipher.card.code).toBe("123");
  expect(cipher.card.expMonth).toBe("1");
  expect(cipher.card.expYear).toBe("2022");
}

function expectIdentity(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.Identity);

  expect(cipher.name).toBe("SomeTitle");
  expect(cipher.identity.fullName).toBe("MyFirstName MyMiddleName MyLastName");
  expect(cipher.identity.firstName).toBe("MyFirstName");
  expect(cipher.identity.middleName).toBe("MyMiddleName");
  expect(cipher.identity.lastName).toBe("MyLastName");
  expect(cipher.identity.email).toBe("hello@bitwarden.com");
  expect(cipher.identity.phone).toBe("123456789");

  expect(cipher.identity.address1).toBe("Test street 123");
  expect(cipher.identity.address2).toBe("additional addressinfo");
  expect(cipher.identity.postalCode).toBe("123456");
  expect(cipher.identity.city).toBe("Cologne");
  expect(cipher.identity.state).toBe("North-Rhine-Westphalia");
  expect(cipher.identity.country).toBe("GERMANY");
  expect(cipher.notes).toBe("SomeNoteToMyIdentity");
}

function expectSecureNote(cipher: CipherView) {
  expect(cipher.type).toBe(CipherType.SecureNote);

  expect(cipher.name).toBe("MySuperSecureNoteTitle");
  expect(cipher.secureNote.type).toBe(SecureNoteType.Generic);
  expect(cipher.notes).toBe("MySuperSecureNote");
}

function expectFields(cipher: CipherView) {
  expect(cipher.fields.length).toBe(2);
  expect(cipher.fields[0].name).toBe("textLabel");
  expect(cipher.fields[0].value).toBe("text value");
  expect(cipher.fields[0].type).toBe(FieldType.Text);
  expect(cipher.fields[1].name).toBe("hiddenLabel");
  expect(cipher.fields[1].value).toBe("hidden value");
  expect(cipher.fields[1].type).toBe(FieldType.Hidden);
}

describe("NordPass CSV Importer", () => {
  let importer: NordPassCsvImporter;
  beforeEach(() => {
    importer = new NordPassCsvImporter();
  });

  it("should return false when not able to parse data", async () => {
    const result = await importer.parse("");

    expect(result).not.toBeNull();
    expect(result.success).toBe(false);
  });

  it("should parse login records", async () => {
    const result = await importer.parse(loginData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expectLogin(cipher);
    expectFields(cipher); //for custom fields
  });

  it("should parse login records with additinal urls", async () => {
    const result = await importer.parse(loginDataWithAdditionalUrls);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expectLoginWithAdditionalUrls(cipher);
  });

  it("should parse credit card records", async () => {
    const result = await importer.parse(creditCardData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expectCreditCard(cipher);
  });

  it("should parse identity records", async () => {
    const result = await importer.parse(
      identityData.replace("#fullName", "MyFirstName MyMiddleName MyLastName"),
    );

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expectIdentity(cipher);
  });

  namesTestData.forEach((data) => {
    it(data.title.replace("#fullName", data.fullName), async () => {
      const result = await importer.parse(identityData.replace("#fullName", data.fullName));

      expect(result).not.toBeNull();
      expect(result.success).toBe(true);
      expect(result.ciphers.length).toBe(1);
      const cipher = result.ciphers[0];
      expect(cipher.identity.firstName).toBe(data.expected.firstName);
      expect(cipher.identity.middleName).toBe(data.expected.middleName);
      expect(cipher.identity.lastName).toBe(data.expected.lastName);
    });
  });

  it("should parse secureNote records", async () => {
    const result = await importer.parse(secureNoteData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expectSecureNote(cipher);
  });

  it("should parse an item and create a folder", async () => {
    const result = await importer.parse(secureNoteData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.folders.length).toBe(1);
    const folder = result.folders[0];
    expect(folder.name).toBe("notesFolder");
  });

  it("should parse an item and create a collection if organizationId is set", async () => {
    importer.organizationId = Utils.newGuid() as OrganizationId;
    const result = await importer.parse(secureNoteData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.collections.length).toBe(1);
    const collection = result.collections[0];
    expect(collection.name).toBe("notesFolder");
  });
});
