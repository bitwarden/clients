import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { SafeInCloudXmlImporter } from "./safeincloud-xml-importer";
import { data as testData } from "./spec-data/safeincloud/test-data.xml";

const multipleLoginsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<database>
    <card title="Server" id="500" autofill="on">
        <field name="Primary login" type="login" autofill="username">primary@example.com</field>
        <field name="Secondary login" type="login" autofill="username">secondary@example.com</field>
        <field name="Password" type="password" autofill="current-password">hunter2</field>
    </card>
</database>
`;

describe("SafeInCloud Xml Importer", () => {
  let importer: SafeInCloudXmlImporter;

  beforeEach(() => {
    importer = new SafeInCloudXmlImporter();
  });

  it("parses the fixture successfully", async () => {
    const result = await importer.parse(testData);
    expect(result.success).toBe(true);
    // Templates (id=102), deleted (Facebook id=301), and ghosts are excluded; 6 cards remain.
    expect(result.ciphers.length).toBe(6);
  });

  it("returns an error when the database node is missing", async () => {
    const result = await importer.parse('<?xml version="1.0"?><root></root>');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Missing `database` node.");
  });

  describe("labels", () => {
    it("does not create folders from SafeInCloud labels", async () => {
      const result = await importer.parse(testData);
      expect(result.folders.length).toBe(0);
      expect(result.folderRelationships.length).toBe(0);
    });
  });

  describe("credit cards", () => {
    let visa: CipherView;

    beforeEach(async () => {
      const result = await importer.parse(testData);
      visa = result.ciphers.find((c) => c.name === "Visa Card (Sample)");
    });

    it("maps a card with a cc-number autofill field to CipherType.Card", () => {
      expect(visa).toBeDefined();
      expect(visa.type).toBe(CipherType.Card);
      expect(visa.login).toBeNull();
    });

    it("populates card primitives from autofill attributes", () => {
      expect(visa.card.number).toBe("5555123456789000");
      // Note: the fixture's "Visa Card (Sample)" actually uses a Mastercard-range
      // number (5555…), so getCardBrandByPatterns returns "Mastercard".
      expect(visa.card.brand).toBe("Mastercard");
      expect(visa.card.cardholderName).toBe("John Smith");
      expect(visa.card.expMonth).toBe("1");
      expect(visa.card.expYear).toBe("2023");
      expect(visa.card.code).toBe("555");
    });

    it("stores a non-CVV PIN as a Hidden custom field", () => {
      const pin = visa.fields.find((f) => f.name === "PIN");
      expect(pin).toBeDefined();
      expect(pin.value).toBe("1111");
      expect(pin.type).toBe(FieldType.Hidden);
    });

    it("does not expose the CVV as a custom field", () => {
      const cvv = visa.fields.find((f) => f.name === "CVV");
      expect(cvv).toBeUndefined();
    });
  });

  describe("logins", () => {
    it("imports the second `type=login` field as a custom field when username is already set", async () => {
      const result = await importer.parse(multipleLoginsXml);
      expect(result.success).toBe(true);
      const cipher = result.ciphers[0];
      expect(cipher.type).toBe(CipherType.Login);
      expect(cipher.login.username).toBe("primary@example.com");
      const extra = cipher.fields.find((f) => f.name === "Secondary login");
      expect(extra).toBeDefined();
      expect(extra.value).toBe("secondary@example.com");
      expect(extra.type).toBe(FieldType.Text);
      expect(cipher.login.password).toBe("hunter2");
    });

    it("imports a `type=secret` field as a Hidden custom field", async () => {
      const result = await importer.parse(testData);
      const google = result.ciphers.find((c) => c.name === "Google (Sample)");
      expect(google).toBeDefined();
      const secret = google.fields.find((f) => f.name === "2FA-Reset");
      expect(secret).toBeDefined();
      expect(secret.value).toBe("thisshouldbehidden");
      expect(secret.type).toBe(FieldType.Hidden);
    });

    it("promotes a `type=password` field to the login password via setPassword", async () => {
      const result = await importer.parse(testData);
      const twitter = result.ciphers.find((c) => c.name === "Twitter (Sample)");
      expect(twitter).toBeDefined();
      expect(twitter.type).toBe(CipherType.Login);
      expect(twitter.login.password).toBe("shouldbepassword");
    });

    it("captures one_time_password fields as TOTP", async () => {
      const result = await importer.parse(testData);
      const google = result.ciphers.find((c) => c.name === "Google (Sample)");
      expect(google.login.totp).toBe("thisisanotp");
    });
  });
});
