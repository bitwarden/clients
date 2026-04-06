import { FieldType } from "@bitwarden/common/vault/enums";

import { OnePassword1PifImporter } from "./onepassword-1pif-importer";

const TestData: string =
  "***aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee***\n" +
  JSON.stringify({
    uuid: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    updatedAt: 1486071244,
    securityLevel: "SL5",
    contentsHash: "aaaaaaaa",
    title: "Imported Entry",
    location: "https://www.google.com",
    secureContents: {
      fields: [
        {
          value: "user@test.net",
          id: "email-input",
          name: "email",
          type: "T",
          designation: "username",
        },
        {
          value: "myservicepassword",
          id: "password-input",
          name: "password",
          type: "P",
          designation: "password",
        },
      ],
      sections: [
        {
          fields: [
            {
              k: "concealed",
              n: "AAAAAAAAAAAABBBBBBBBBBBCCCCCCCCC",
              v: "console-password-123",
              t: "console password",
            },
          ],
          title: "Admin Console",
          name: "admin_console",
        },
      ],
      passwordHistory: [
        {
          value: "old-password",
          time: 1447791421,
        },
      ],
    },
    URLs: [
      {
        label: "website",
        url: "https://www.google.com",
      },
    ],
    txTimestamp: 1508941334,
    createdAt: 1390426636,
    typeName: "webforms.WebForm",
  });

const WindowsOpVaultTestData = JSON.stringify({
  category: "001",
  created: 1544823719,
  hmac: "NtyBmTTPOb88HV3JUKPx1xl/vcMhac9kvCfe/NtszY0=",
  k: "**REMOVED LONG LINE FOR LINTER** -Kyle",
  tx: 1553395669,
  updated: 1553395669,
  uuid: "528AB076FB5F4FBF960884B8E01619AC",
  overview: {
    title: "Google",
    URLs: [
      {
        u: "google.com",
      },
    ],
    url: "google.com",
    ps: 26,
    ainfo: "googluser",
  },
  details: {
    passwordHistory: [
      {
        value: "oldpass1",
        time: 1553394449,
      },
      {
        value: "oldpass2",
        time: 1553394457,
      },
      {
        value: "oldpass3",
        time: 1553394458,
      },
      {
        value: "oldpass4",
        time: 1553394459,
      },
      {
        value: "oldpass5",
        time: 1553394460,
      },
      {
        value: "oldpass6",
        time: 1553394461,
      },
    ],
    fields: [
      {
        type: "T",
        id: "username",
        name: "username",
        value: "googluser",
        designation: "username",
      },
      {
        type: "P",
        id: "password",
        name: "password",
        value: "12345678901",
        designation: "password",
      },
    ],
    notesPlain: "This is a note\r\n\r\nline1\r\nline2",
    sections: [
      {
        title: "test",
        name: "1214FD88CD30405D9EED14BEB4D61B60",
        fields: [
          {
            k: "string",
            n: "6CC3BD77482D4559A4B8BB2D360F821B",
            v: "fgfg",
            t: "fgggf",
          },
          {
            k: "concealed",
            n: "5CFE7BCAA1DF4578BBF7EB508959BFF3",
            v: "dfgdfgfdg",
            t: "pwfield",
          },
        ],
      },
    ],
  },
});

const IdentityTestData = JSON.stringify({
  uuid: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  updatedAt: 1553365894,
  securityLevel: "SL5",
  contentsHash: "eeeeeeee",
  title: "Test Identity",
  secureContents: {
    lastname: "Fritzenberger",
    zip: "223344",
    birthdate_dd: "11",
    homephone: "+49 333 222 111",
    company: "Web Inc.",
    firstname: "Frank",
    birthdate_mm: "3",
    country: "de",
    sex: "male",
    sections: [
      {
        fields: [
          {
            k: "string",
            inputTraits: {
              autocapitalization: "Words",
            },
            n: "firstname",
            v: "Frank",
            a: {
              guarded: "yes",
            },
            t: "first name",
          },
          {
            k: "string",
            inputTraits: {
              autocapitalization: "Words",
            },
            n: "initial",
            v: "MD",
            a: {
              guarded: "yes",
            },
            t: "initial",
          },
          {
            k: "string",
            inputTraits: {
              autocapitalization: "Words",
            },
            n: "lastname",
            v: "Fritzenberger",
            a: {
              guarded: "yes",
            },
            t: "last name",
          },
          {
            k: "menu",
            v: "male",
            n: "sex",
            a: {
              guarded: "yes",
            },
            t: "sex",
          },
          {
            k: "date",
            v: 1552305660,
            n: "birthdate",
            a: {
              guarded: "yes",
            },
            t: "birth date",
          },
          {
            k: "string",
            inputTraits: {
              autocapitalization: "Words",
            },
            n: "occupation",
            v: "Engineer",
            a: {
              guarded: "yes",
            },
            t: "occupation",
          },
          {
            k: "string",
            inputTraits: {
              autocapitalization: "Words",
            },
            n: "company",
            v: "Web Inc.",
            a: {
              guarded: "yes",
            },
            t: "company",
          },
          {
            k: "string",
            inputTraits: {
              autocapitalization: "Words",
            },
            n: "department",
            v: "IT",
            a: {
              guarded: "yes",
            },
            t: "department",
          },
          {
            k: "string",
            inputTraits: {
              autocapitalization: "Words",
            },
            n: "jobtitle",
            v: "Developer",
            a: {
              guarded: "yes",
            },
            t: "job title",
          },
        ],
        title: "Identification",
        name: "name",
      },
      {
        fields: [
          {
            k: "address",
            inputTraits: {
              autocapitalization: "Sentences",
            },
            n: "address",
            v: {
              street: "Mainstreet 1",
              city: "Berlin",
              country: "de",
              zip: "223344",
            },
            a: {
              guarded: "yes",
            },
            t: "address",
          },
          {
            k: "phone",
            v: "+49 001 222 333 44",
            n: "defphone",
            a: {
              guarded: "yes",
            },
            t: "default phone",
          },
          {
            k: "phone",
            v: "+49 333 222 111",
            n: "homephone",
            a: {
              guarded: "yes",
            },
            t: "home",
          },
          {
            k: "phone",
            n: "cellphone",
            a: {
              guarded: "yes",
            },
            t: "mobile",
          },
          {
            k: "phone",
            n: "busphone",
            a: {
              guarded: "yes",
            },
            t: "business",
          },
        ],
        title: "Address",
        name: "address",
      },
      {
        fields: [
          {
            k: "string",
            n: "username",
            a: {
              guarded: "yes",
            },
            t: "username",
          },
          {
            k: "string",
            n: "reminderq",
            t: "reminder question",
          },
          {
            k: "string",
            n: "remindera",
            t: "reminder answer",
          },
          {
            k: "string",
            inputTraits: {
              keyboard: "EmailAddress",
            },
            n: "email",
            v: "test@web.de",
            a: {
              guarded: "yes",
            },
            t: "email",
          },
          {
            k: "string",
            n: "website",
            inputTraits: {
              keyboard: "URL",
            },
            t: "website",
          },
          {
            k: "string",
            n: "icq",
            t: "ICQ",
          },
          {
            k: "string",
            n: "skype",
            t: "skype",
          },
          {
            k: "string",
            n: "aim",
            t: "AOL/AIM",
          },
          {
            k: "string",
            n: "yahoo",
            t: "Yahoo",
          },
          {
            k: "string",
            n: "msn",
            t: "MSN",
          },
          {
            k: "string",
            n: "forumsig",
            t: "forum signature",
          },
        ],
        title: "Internet Details",
        name: "internet",
      },
      {
        title: "Related Items",
        name: "linked items",
      },
    ],
    initial: "MD",
    address1: "Mainstreet 1",
    city: "Berlin",
    jobtitle: "Developer",
    occupation: "Engineer",
    department: "IT",
    email: "test@web.de",
    birthdate_yy: "2019",
    homephone_local: "+49 333 222 111",
    defphone_local: "+49 001 222 333 44",
    defphone: "+49 001 222 333 44",
  },
  txTimestamp: 1553365894,
  createdAt: 1553364679,
  typeName: "identities.Identity",
});

describe("1Password 1Pif Importer", () => {
  it("should parse data", async () => {
    const importer = new OnePassword1PifImporter();
    const result = await importer.parse(TestData);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.login.username).toEqual("user@test.net");
    expect(cipher.login.password).toEqual("myservicepassword");
    expect(cipher.login.uris.length).toEqual(1);
    const uriView = cipher.login.uris.shift();
    expect(uriView.uri).toEqual("https://www.google.com");
  });

  it('should create concealed field as "hidden" type', async () => {
    const importer = new OnePassword1PifImporter();
    const result = await importer.parse(TestData);
    expect(result != null).toBe(true);

    const ciphers = result.ciphers;
    expect(ciphers.length).toEqual(1);

    const cipher = ciphers.shift();
    const fields = cipher.fields;
    expect(fields.length).toEqual(1);

    const field = fields.shift();
    expect(field.name).toEqual("console password");
    expect(field.value).toEqual("console-password-123");
    expect(field.type).toEqual(FieldType.Hidden);
  });

  it("should create identity records", async () => {
    const importer = new OnePassword1PifImporter();
    const result = await importer.parse(IdentityTestData);
    expect(result != null).toBe(true);
    const cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("Test Identity");

    const identity = cipher.identity;
    expect(identity.firstName).toEqual("Frank");
    expect(identity.middleName).toEqual("MD");
    expect(identity.lastName).toEqual("Fritzenberger");
    expect(identity.company).toEqual("Web Inc.");
    expect(identity.address1).toEqual("Mainstreet 1");
    expect(identity.country).toEqual("DE");
    expect(identity.city).toEqual("Berlin");
    expect(identity.postalCode).toEqual("223344");
    expect(identity.phone).toEqual("+49 001 222 333 44");
    expect(identity.email).toEqual("test@web.de");

    // remaining fields as custom fields
    expect(cipher.fields.length).toEqual(6);
    const fields = cipher.fields;
    expect(fields[0].name).toEqual("sex");
    expect(fields[0].value).toEqual("male");
    expect(fields[1].name).toEqual("birth date");
    expect(fields[1].value).toEqual("Mon, 11 Mar 2019 12:01:00 GMT");
    expect(fields[2].name).toEqual("occupation");
    expect(fields[2].value).toEqual("Engineer");
    expect(fields[3].name).toEqual("department");
    expect(fields[3].value).toEqual("IT");
    expect(fields[4].name).toEqual("job title");
    expect(fields[4].value).toEqual("Developer");
    expect(fields[5].name).toEqual("home");
    expect(fields[5].value).toEqual("+49 333 222 111");
  });

  it("should create password history", async () => {
    const importer = new OnePassword1PifImporter();
    const result = await importer.parse(TestData);
    const cipher = result.ciphers.shift();

    expect(cipher.passwordHistory.length).toEqual(1);
    const ph = cipher.passwordHistory.shift();
    expect(ph.password).toEqual("old-password");
    expect(ph.lastUsedDate.toISOString()).toEqual("2015-11-17T20:17:01.000Z");
  });

  it("should create password history from windows opvault 1pif format", async () => {
    const importer = new OnePassword1PifImporter();
    const result = await importer.parse(WindowsOpVaultTestData);
    const cipher = result.ciphers.shift();

    expect(cipher.passwordHistory.length).toEqual(5);
    let ph = cipher.passwordHistory.shift();
    expect(ph.password).toEqual("oldpass6");
    expect(ph.lastUsedDate.toISOString()).toEqual("2019-03-24T02:27:41.000Z");
    ph = cipher.passwordHistory.shift();
    expect(ph.password).toEqual("oldpass5");
    expect(ph.lastUsedDate.toISOString()).toEqual("2019-03-24T02:27:40.000Z");
    ph = cipher.passwordHistory.shift();
    expect(ph.password).toEqual("oldpass4");
    expect(ph.lastUsedDate.toISOString()).toEqual("2019-03-24T02:27:39.000Z");
    ph = cipher.passwordHistory.shift();
    expect(ph.password).toEqual("oldpass3");
    expect(ph.lastUsedDate.toISOString()).toEqual("2019-03-24T02:27:38.000Z");
    ph = cipher.passwordHistory.shift();
    expect(ph.password).toEqual("oldpass2");
    expect(ph.lastUsedDate.toISOString()).toEqual("2019-03-24T02:27:37.000Z");
  });
});
