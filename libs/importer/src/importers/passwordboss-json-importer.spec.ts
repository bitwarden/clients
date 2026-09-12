import { CipherType } from "@bitwarden/common/vault/enums";

import { PasswordBossJsonImporter } from "./passwordboss-json-importer";

// Current "Password Boss JSON - Not Encrypted" export: a flat array of items, card/login fields
// directly on the item, and no separate `folders` list.
const flatExport = JSON.stringify([
  {
    id: "b0e7dbdb-71d5-4449-87a7-91b2b185dc4a",
    itemType: 2,
    folder: "Personal",
    logoColor: "#E92763",
    username: "usernameTest",
    password: "passwordTest",
    name: "testPW",
    notes: "",
    url: "test.com",
    totp: "JBSWY3DPEHPK3PXP",
    accountType: "personal",
    customFields: [{ name: "Security Question", value: "Answer" }],
    tags: [],
    itemTypeName: "Website",
  },
  {
    id: "b9e905d5-709e-4d7d-95e6-384255df426d",
    itemType: 11,
    folder: null,
    logoColor: "#2196F3",
    username: "",
    password: "",
    name: "Personal Card",
    notes: "",
    cardNumber: "4111111111111111",
    nameOnCard: "Jane Doe",
    expirationDate: "2030-01-31T23:59:59.000Z",
    cardType: "visa",
    issuingBank: "",
    securityCode: "",
    issueDate: "",
    pin: "",
    tags: [],
    itemTypeName: "CreditCard",
  },
  {
    id: "c1e905d5-709e-4d7d-95e6-384255df4270",
    itemType: 5,
    folder: null,
    logoColor: "#000000",
    username: "",
    password: "",
    name: "Wifi note",
    notes: "Home wifi: ABC123",
    url: "",
    customFields: [],
    tags: [],
    itemTypeName: "SecureNote",
  },
]);

// Older export shape from before Password Boss changed its export format.
const legacyExport = JSON.stringify({
  folders: [{ id: "f1", name: "Personal" }],
  items: [
    {
      name: "Amazon",
      type: "Website",
      login_url: "https://amazon.com",
      folder: "f1",
      identifiers: {
        username: "jdoe@example.com",
        password: "Sup3rSecret!",
        notes: "line one\\r\\nline two",
      },
    },
  ],
});

describe("Password Boss JSON Importer", () => {
  let importer: PasswordBossJsonImporter;

  beforeEach(() => {
    importer = new PasswordBossJsonImporter();
  });

  it("parses the current flat-array export format", async () => {
    const result = await importer.parse(flatExport);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toEqual(3);

    const login = result.ciphers[0];
    expect(login.name).toEqual("testPW");
    expect(login.type).toEqual(CipherType.Login);
    expect(login.login.username).toEqual("usernameTest");
    expect(login.login.password).toEqual("passwordTest");
    expect(login.login.uris[0].uri).toEqual("http://test.com");
    expect(login.login.totp).toEqual("JBSWY3DPEHPK3PXP");
    expect(login.fields.map((f) => [f.name, f.value])).toEqual(
      expect.arrayContaining([
        ["Security Question", "Answer"],
        ["accountType", "personal"],
      ]),
    );

    const card = result.ciphers[1];
    expect(card.name).toEqual("Personal Card");
    expect(card.type).toEqual(CipherType.Card);
    expect(card.card.number).toEqual("4111111111111111");
    expect(card.card.cardholderName).toEqual("Jane Doe");
    // Verifies expiration is parsed in UTC, not local time: under a positive-offset timezone,
    // reading this UTC instant with local getters would roll it over into February.
    expect(card.card.expYear).toEqual("2030");
    expect(card.card.expMonth).toEqual("1");
    expect(card.fields.some((f) => f.name === "cardType")).toBe(false);

    const note = result.ciphers[2];
    expect(note.name).toEqual("Wifi note");
    expect(note.type).toEqual(CipherType.SecureNote);
    expect(note.notes).toEqual("Home wifi: ABC123");

    expect(result.folders.length).toEqual(1);
    expect(result.folders[0].name).toEqual("Personal");
    expect(result.folderRelationships.length).toEqual(1);
    expect(result.folderRelationships[0]).toEqual([0, 0]);
  });

  it("parses card expiration in UTC regardless of local timezone", async () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "Asia/Tokyo";
    try {
      const result = await importer.parse(flatExport);
      const card = result.ciphers[1];
      expect(card.card.expYear).toEqual("2030");
      expect(card.card.expMonth).toEqual("1");
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it("parses the older nested export format", async () => {
    const result = await importer.parse(legacyExport);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toEqual(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toEqual("Amazon");
    expect(cipher.login.username).toEqual("jdoe@example.com");
    expect(cipher.login.password).toEqual("Sup3rSecret!");
    expect(cipher.notes).toEqual("line one\nline two");

    expect(result.folders.length).toEqual(1);
    expect(result.folders[0].name).toEqual("Personal");
  });

  it("fails when the older export format is missing items", async () => {
    const result = await importer.parse(JSON.stringify({ folders: [] }));
    expect(result.success).toBe(false);
  });
});
