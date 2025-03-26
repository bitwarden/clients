import { CipherType } from "@bitwarden/common/vault/enums";

import { MSecureCsvImporter } from "./msecure-csv-importer";

describe("MSecureCsvImporter.parse", () => {
  let importer: MSecureCsvImporter;
  beforeEach(() => {
    importer = new MSecureCsvImporter();
  });

  it("should correctly parse legacy formatted cards", async () => {
    const mockCsvData =
      `aWeirdOldStyleCard|1032,Credit Card,,Security code 1234,Card Number|12|5555 4444 3333 2222,Expiration Date|11|04/0029,Name on Card|9|Obi Wan Kenobi,Security Code|9|444,`.trim();
    const result = await importer.parse(mockCsvData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("aWeirdOldStyleCard");
    expect(cipher.type).toBe(CipherType.Card);
    expect(cipher.card.number).toBe("5555 4444 3333 2222");
    expect(cipher.card.expiration).toBe("04 / 2029");
    expect(cipher.card.code).toBe("444");
    expect(cipher.card.cardholderName).toBe("Obi Wan Kenobi");
    expect(cipher.notes).toBe("Security code 1234");
    expect(cipher.card.brand).toBe("");
  });

  it("should correctly parse credit card entries as Secret Notes", async () => {
    const mockCsvData =
      `myCreditCard|155089404,Credit Card,,,Card Number|12|41111111111111111,Expiration Date|11|05/2026,Security Code|9|123,Name on Card|0|John Doe,PIN|9|1234,Issuing Bank|0|Visa,Phone Number|4|,Billing Address|0|,`.trim();
    const result = await importer.parse(mockCsvData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("myCreditCard");
    expect(cipher.type).toBe(CipherType.Card);
    expect(cipher.card.number).toBe("41111111111111111");
    expect(cipher.card.expiration).toBe("05 / 2026");
    expect(cipher.card.code).toBe("123");
    expect(cipher.card.cardholderName).toBe("John Doe");
    expect(cipher.card.brand).toBe("Visa");
  });

  it("should correctly parse login entries", async () => {
    const mockCsvData = `
        Bitwarden|810974637,Login,,,Website|2|bitwarden.com,Username|7|bitwarden user,Password|8|bitpassword,
    `.trim();

    const result = await importer.parse(mockCsvData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Bitwarden");
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.login.username).toBe("bitwarden user");
    expect(cipher.login.password).toBe("bitpassword");
    expect(cipher.login.uris[0].uri).toContain("bitwarden.com");
  });

  it("should correctly parse login entries with notes", async () => {
    const mockCsvData =
      `Example|188987444,Login,,This is a note |,Website|2|example2.com,Username|7|username || lol,Password|8|this is a password,`.trim();

    const result = await importer.parse(mockCsvData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Example");
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.login.username).toBe("username || lol");
    expect(cipher.login.password).toBe("this is a password");
    expect(cipher.login.uris[0].uri).toContain("example2.com");
    expect(cipher.notes).toBe("This is a note |");
  });

  it("should correctly parse login entries with a tag", async () => {
    const mockCsvData = `
        Website with a tag|1401978655,Login,tag holding it,,Website|2|johndoe.com,Username|7|JohnDoeWebsite,Password|8|JohnDoePassword,
    `.trim();

    const result = await importer.parse(mockCsvData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Website with a tag");
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.login.username).toBe("JohnDoeWebsite");
    expect(cipher.login.password).toBe("JohnDoePassword");
    expect(cipher.login.uris[0].uri).toContain("johndoe.com");
    expect(cipher.notes).toBeNull();
    expect(result.folders[0].name).toContain("tag holding it");
  });

  it("should handle multiple entries correctly", async () => {
    const mockCsvData =
      `myCreditCard|155089404,Credit Card,,,Card Number|12|41111111111111111,Expiration Date|11|05/2026,Security Code|9|123,Name on Card|0|John Doe,PIN|9|1234,Issuing Bank|0|Visa,Phone Number|4|,Billing Address|0|,
Bitwarden|810974637,Login,,,Website|2|bitwarden.com,Username|7|bitwarden user,Password|8|bitpassword,
Example|188987444,Login,,This is a note |,Website|2|example2.com,Username|7|username || lol,Password|8|this is a password,
Website with a tag|1401978655,Login,tag holding it,,Website|2|johndoe.com,Username|7|JohnDoeWebsite,Password|8|JohnDoePassword,`.trim();

    const result = await importer.parse(mockCsvData);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(4);

    // Check first entry (Credit Card)
    const cipher1 = result.ciphers[0];
    expect(cipher1.name).toBe("myCreditCard");
    expect(cipher1.type).toBe(CipherType.Card);

    // Check second entry (Login - Bitwarden)
    const cipher2 = result.ciphers[1];
    expect(cipher2.name).toBe("Bitwarden");
    expect(cipher2.type).toBe(CipherType.Login);

    // Check third entry (Login with note - Example)
    const cipher3 = result.ciphers[2];
    expect(cipher3.name).toBe("Example");
    expect(cipher3.type).toBe(CipherType.Login);

    // Check fourth entry (Login with tag - Website with a tag)
    const cipher4 = result.ciphers[3];
    expect(cipher4.name).toBe("Website with a tag");
    expect(cipher4.type).toBe(CipherType.Login);
  });
});
