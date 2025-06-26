import { MacOS_PasswordDepotXmlFile, MacOS_WrongVersion } from "../spec-data/password-depot-xml";

import { PasswordDepot17XmlImporter } from "./password-depot-17-xml-importer";

describe("Password Depot 17 MacOS Xml Importer", () => {
  it("should return error with invalid export version", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(MacOS_WrongVersion);
    expect(result.errorMessage).toBe(
      "Unsupported export version detected - (only 17.0 is supported)",
    );
  });

  it("should parse custom fields from a MacOS exported file", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(MacOS_PasswordDepotXmlFile);

    const cipher = result.ciphers.shift();
    expect(cipher.name).toBe("card 1");
    expect(cipher.notes).toBe("comment");

    expect(cipher.card).not.toBeNull();

    expect(cipher.card.cardholderName).toBe("some CC holder");
    expect(cipher.card.number).toBe("4242424242424242");
    expect(cipher.card.brand).toBe("Visa");
    expect(cipher.card.expMonth).toBe("8");
    expect(cipher.card.expYear).toBe("2028");
    expect(cipher.card.code).toBe("125");
  });
});
