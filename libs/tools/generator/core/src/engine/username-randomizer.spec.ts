import { mock } from "jest-mock-extended";

import { EFFLongWordList } from "@bitwarden/common/platform/misc/wordlist";

import { Algorithm, Type } from "../metadata";

import { Randomizer } from "./abstractions";
import { UsernameRandomizer } from "./username-randomizer";

describe("UsernameRandomizer", () => {
  const randomizer = mock<Randomizer>();

  beforeEach(() => {
    randomizer.pickWord.mockResolvedValue("username");
    randomizer.uniform.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("randomWords", () => {
    it("generates a random word", async () => {
      const usernameRandomizer = new UsernameRandomizer(randomizer);

      const result = await usernameRandomizer.randomWords();

      expect(result).toEqual("username");
    });

    it("generates multiple random words", async () => {
      const usernameRandomizer = new UsernameRandomizer(randomizer);

      const result = await usernameRandomizer.randomWords({ numberOfWords: 2 });

      expect(result).toEqual("usernameusername");
    });

    it("returns an empty string if length is 0", async () => {
      const usernameRandomizer = new UsernameRandomizer(randomizer);

      const result = await usernameRandomizer.randomWords({ numberOfWords: 0 });

      expect(result).toEqual("");
    });

    it("returns an empty string if length is less than 0", async () => {
      const usernameRandomizer = new UsernameRandomizer(randomizer);

      const result = await usernameRandomizer.randomWords({ numberOfWords: -1 });

      expect(result).toEqual("");
    });

    it("selects from a custom wordlist", async () => {
      const usernameRandomizer = new UsernameRandomizer(randomizer);

      const expectedWords: string[] = [];
      const result = await usernameRandomizer.randomWords({
        numberOfWords: 1,
        words: expectedWords,
      });

      expect(result).toEqual("username");
      expect(randomizer.pickWord).toHaveBeenCalledWith(expectedWords, { titleCase: false });
    });

    it("camelCases words", async () => {
      const usernameRandomizer = new UsernameRandomizer(randomizer);

      const result = await usernameRandomizer.randomWords({
        numberOfWords: 2,
        casing: "camelCase",
      });

      expect(result).toEqual("usernameusername");
      expect(randomizer.pickWord).toHaveBeenNthCalledWith(1, EFFLongWordList, { titleCase: false });
      expect(randomizer.pickWord).toHaveBeenNthCalledWith(2, EFFLongWordList, { titleCase: true });
    });

    it("TitleCasesWords", async () => {
      const usernameRandomizer = new UsernameRandomizer(randomizer);

      const result = await usernameRandomizer.randomWords({
        numberOfWords: 2,
        casing: "TitleCase",
      });

      expect(result).toEqual("usernameusername");
      expect(randomizer.pickWord).toHaveBeenNthCalledWith(1, EFFLongWordList, { titleCase: true });
      expect(randomizer.pickWord).toHaveBeenNthCalledWith(2, EFFLongWordList, { titleCase: true });
    });

    it("lowercases words", async () => {
      const usernameRandomizer = new UsernameRandomizer(randomizer);

      const result = await usernameRandomizer.randomWords({
        numberOfWords: 2,
        casing: "lowercase",
      });

      expect(result).toEqual("usernameusername");
      expect(randomizer.pickWord).toHaveBeenNthCalledWith(1, EFFLongWordList, { titleCase: false });
      expect(randomizer.pickWord).toHaveBeenNthCalledWith(2, EFFLongWordList, { titleCase: false });
    });
  });

  describe("generate", () => {
    it("processes username generation options", async () => {
      const username = new UsernameRandomizer(randomizer);

      const result = await username.generate(
        { algorithm: Algorithm.username },
        {
          wordIncludeNumber: true,
        },
      );

      expect(result.category).toEqual(Type.username);
    });

    it("throws when it cannot recognize the options type", async () => {
      const username = new UsernameRandomizer(randomizer);

      const result = username.generate({ algorithm: Algorithm.passphrase }, {});

      await expect(result).rejects.toBeInstanceOf(Error);
    });
  });
});
