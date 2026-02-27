import { mock } from "jest-mock-extended";

import { GeneratedCredential } from "./generated-credential";
import { GeneratedPasswordHistory } from "./generated-password-history";
import { GENERATOR_HISTORY_BUFFER } from "./key-definitions";
import { LegacyPasswordHistoryDecryptor } from "./legacy-password-history-decryptor";

describe("Key definitions", () => {
  describe("GENERATOR_HISTORY_BUFFER", () => {
    describe("options.deserializer", () => {
      it("should deserialize generated password history", () => {
        const value: any = [{ password: "foo", date: 1 }];

        const [result] = GENERATOR_HISTORY_BUFFER.options.deserializer(value);

        expect(result).toEqual(value[0]);
        expect(result).toBeInstanceOf(GeneratedPasswordHistory);
      });

      it.each([[undefined], [null]])("should ignore nullish (= %p) history", (value: any) => {
        const result = GENERATOR_HISTORY_BUFFER.options.deserializer(value);

        expect(result).toEqual(undefined);
      });
    });

    it("should map generated password history to generated credentials", async () => {
      const value: any = [new GeneratedPasswordHistory("foo", 1)];
      const decryptor = mock<LegacyPasswordHistoryDecryptor>({
        decrypt(value) {
          return Promise.resolve(value);
        },
      });

      const [result] = await GENERATOR_HISTORY_BUFFER.map(value, decryptor);

      expect(result).toEqual({
        credential: "foo",
        category: "password",
        generationDate: new Date(1),
      });
      expect(result).toBeInstanceOf(GeneratedCredential);
    });

    describe("isValid", () => {
      it("should accept histories with at least one entry", async () => {
        const value: any = [new GeneratedPasswordHistory("foo", 1)];
        const decryptor = {} as any;

        const result = await GENERATOR_HISTORY_BUFFER.isValid(value, decryptor);

        expect(result).toEqual(true);
      });

      it("should reject histories with no entries", async () => {
        const value: any = [];
        const decryptor = {} as any;

        const result = await GENERATOR_HISTORY_BUFFER.isValid(value, decryptor);

        expect(result).toEqual(false);
      });
    });
  });
});
