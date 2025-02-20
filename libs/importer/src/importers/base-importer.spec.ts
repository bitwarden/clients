import { CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BaseImporter } from "./base-importer";

class FakeBaseImporter extends BaseImporter {
  initLoginCipher(): CipherView {
    return super.initLoginCipher();
  }

  setCardExpiration(cipher: CipherView, expiration: string): boolean {
    return super.setCardExpiration(cipher, expiration);
  }

  parseXml(data: string): Document {
    return super.parseXml(data);
  }
}

describe("BaseImporter class", () => {
  const importer = new FakeBaseImporter();
  let cipher: CipherView;

  describe("setCardExpiration method", () => {
    beforeEach(() => {
      cipher = importer.initLoginCipher();
      cipher.card = new CardView();
      cipher.type = CipherType.Card;
    });

    it.each([
      ["01/2025", "1", "2025"],
      ["5/21", "5", "2021"],
      ["10/2100", "10", "2100"],
    ])(
      "sets ciper card expYear & expMonth and returns true",
      (expiration, expectedMonth, expectedYear) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(cipher.card.expMonth).toBe(expectedMonth);
        expect(cipher.card.expYear).toBe(expectedYear);
        expect(result).toBe(true);
      },
    );

    it.each([
      ["01/2032", "1"],
      ["09/2032", "9"],
      ["10/2032", "10"],
    ])("removes leading zero from month", (expiration, expectedMonth) => {
      const result = importer.setCardExpiration(cipher, expiration);
      expect(cipher.card.expMonth).toBe(expectedMonth);
      expect(cipher.card.expYear).toBe("2032");
      expect(result).toBe(true);
    });

    it.each([
      ["12/00", "2000"],
      ["12/99", "2099"],
      ["12/32", "2032"],
      ["12/2042", "2042"],
    ])("prefixes '20' to year if only two digits long", (expiration, expectedYear) => {
      const result = importer.setCardExpiration(cipher, expiration);
      expect(cipher.card.expYear).toHaveLength(4);
      expect(cipher.card.expYear).toBe(expectedYear);
      expect(result).toBe(true);
    });

    it.each([["01 / 2025"], ["01  /  2025"], ["  01/2025  "], [" 01/2025 "]])(
      "removes any whitespace in expiration string",
      (expiration) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(cipher.card.expMonth).toBe("1");
        expect(cipher.card.expYear).toBe("2025");
        expect(result).toBe(true);
      },
    );

    it.each([[""], ["  "], [null]])(
      "returns false if expiration is null or empty ",
      (expiration) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(result).toBe(false);
      },
    );

    it.each([["0123"], ["01/03/23"]])(
      "returns false if invalid card expiration string",
      (expiration) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(result).toBe(false);
      },
    );

    it.each([["5/"], ["03/231"], ["12/1"], ["2/20221"]])(
      "returns false if year is not 2 or 4 digits long",
      (expiration) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(result).toBe(false);
      },
    );

    it.each([["/2023"], ["003/2023"], ["111/32"]])(
      "returns false if month is not 1 or 2 digits long",
      (expiration) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(result).toBe(false);
      },
    );

    it("parse XML should reject xml with external entities", async () => {
      const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
        <!DOCTYPE replace [
        <!ELEMENT replace ANY>
        <!ENTITY xxe "External entity">
        ]>
        <passwordsafe delimiter=";">
        <entry><title>PoC XXE</title><username>&xxe;</username></entry>
        </passwordsafe>`;
      const result = importer.parseXml(xml);
      expect(result).toBe(null);
    });
  });
});
