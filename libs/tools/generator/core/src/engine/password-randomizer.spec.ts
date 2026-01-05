import { mock } from "jest-mock-extended";

import { EFFLongWordList } from "@bitwarden/common/platform/misc/wordlist";

import { Randomizer } from "../abstractions";
import { Algorithm, Type } from "../metadata";

import { Ascii } from "./data";
import { PasswordRandomizer } from "./password-randomizer";
import { CharacterSet, RandomAsciiRequest } from "./types";

describe("PasswordRandomizer", () => {
  const randomizer = mock<Randomizer>();

  beforeEach(() => {
    randomizer.shuffle.mockImplementation((items) => {
      return Promise.resolve([...items]);
    });

    randomizer.pick.mockImplementation((items) => {
      return Promise.resolve(items[0]);
    });

    randomizer.pickWord.mockResolvedValue("foo");
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("randomAscii", () => {
    it("returns the empty string when no character sets are specified", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 1,
        ambiguous: true,
      });

      expect(result).toEqual("");
    });

    it("generates an uppercase ascii password", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        uppercase: 1,
        ambiguous: true,
      });

      expect(result).toEqual("A");
      expect(randomizer.pick).toHaveBeenCalledWith(Ascii.Full.Uppercase);
    });

    it("generates an uppercase ascii password without ambiguous characters", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        uppercase: 1,
        ambiguous: false,
      });

      expect(result).toEqual("A");
      expect(randomizer.pick).toHaveBeenCalledWith(Ascii.Unmistakable.Uppercase);
    });

    it("generates a lowercase ascii password", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        lowercase: 1,
        ambiguous: true,
      });

      expect(result).toEqual("a");
      expect(randomizer.pick).toHaveBeenCalledWith(Ascii.Full.Lowercase);
    });

    it("generates a lowercase ascii password without ambiguous characters", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        lowercase: 1,
        ambiguous: false,
      });

      expect(result).toEqual("a");
      expect(randomizer.pick).toHaveBeenCalledWith(Ascii.Unmistakable.Lowercase);
    });

    it("generates a numeric ascii password", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        digits: 1,
        ambiguous: true,
      });

      expect(result).toEqual("0");
      expect(randomizer.pick).toHaveBeenCalledWith(Ascii.Full.Digit);
    });

    it("generates a numeric password without ambiguous characters", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        digits: 1,
        ambiguous: false,
      });

      expect(result).toEqual("2");
      expect(randomizer.pick).toHaveBeenCalledWith(Ascii.Unmistakable.Digit);
    });

    it("generates a special character password", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        special: 1,
        ambiguous: true,
      });

      expect(result).toEqual("!");
      expect(randomizer.pick).toHaveBeenCalledWith(Ascii.Full.Special);
    });

    it("generates a special character password without ambiguous characters", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        special: 1,
        ambiguous: false,
      });

      expect(result).toEqual("!");
      expect(randomizer.pick).toHaveBeenCalledWith(Ascii.Unmistakable.Special);
    });

    it.each([
      [2, "AA"],
      [3, "AAA"],
    ])("includes %p uppercase characters", async (uppercase, expected) => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        uppercase,
        ambiguous: true,
      });

      expect(result).toEqual(expected);
    });

    it.each([
      [2, "aa"],
      [3, "aaa"],
    ])("includes %p lowercase characters", async (lowercase, expected) => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        lowercase,
        ambiguous: true,
      });

      expect(result).toEqual(expected);
    });

    it.each([
      [2, "00"],
      [3, "000"],
    ])("includes %p digits", async (digits, expected) => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        digits,
        ambiguous: true,
      });

      expect(result).toEqual(expected);
    });

    it.each([
      [2, "!!"],
      [3, "!!!"],
    ])("includes %p special characters", async (special, expected) => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomAscii({
        all: 0,
        special,
        ambiguous: true,
      });

      expect(result).toEqual(expected);
    });

    it.each([
      [{ uppercase: 0 }, Ascii.Full.Uppercase],
      [{ lowercase: 0 }, Ascii.Full.Lowercase],
      [{ digits: 0 }, Ascii.Full.Digit],
      [{ special: 0 }, Ascii.Full.Special],
    ])(
      "mixes character sets for the remaining characters (=%p)",
      async (setting: Partial<RandomAsciiRequest>, set: CharacterSet) => {
        const password = new PasswordRandomizer(randomizer, Date.now);

        await password.randomAscii({
          ...setting,
          all: 1,
          ambiguous: true,
        });

        expect(randomizer.pick).toHaveBeenCalledWith(set);
      },
    );

    it("shuffles the password characters", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      // Typically `shuffle` randomizes the order of the array it's been
      // given. In the password generator, the array is generated from the
      // options. Thus, returning a fixed set of results effectively overrides
      // the randomizer's arguments.
      randomizer.shuffle.mockImplementation(() => {
        const results = [Ascii.Full.Uppercase, Ascii.Full.Digit];
        return Promise.resolve(results);
      });

      const result = await password.randomAscii({
        all: 0,
        ambiguous: true,
      });

      expect(result).toEqual("A0");
    });
  });

  describe("randomEffLongWords", () => {
    it("generates the empty string when no words are passed", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomEffLongWords({
        numberOfWords: 0,
        separator: "",
        number: false,
        capitalize: false,
      });

      expect(result).toEqual("");
    });

    it.each([
      [1, "foo"],
      [2, "foofoo"],
    ])("generates a %i-length word list", async (words, expected) => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomEffLongWords({
        numberOfWords: words,
        separator: "",
        number: false,
        capitalize: false,
      });

      expect(result).toEqual(expected);
      expect(randomizer.pickWord).toHaveBeenCalledWith(EFFLongWordList, {
        titleCase: false,
        number: false,
      });
    });

    it("capitalizes the word list", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);
      randomizer.pickWord.mockResolvedValueOnce("Foo");

      const result = await password.randomEffLongWords({
        numberOfWords: 1,
        separator: "",
        number: false,
        capitalize: true,
      });

      expect(result).toEqual("Foo");
      expect(randomizer.pickWord).toHaveBeenCalledWith(EFFLongWordList, {
        titleCase: true,
        number: false,
      });
    });

    it("includes a random number on a random word", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);
      randomizer.pickWord.mockResolvedValueOnce("foo");
      randomizer.pickWord.mockResolvedValueOnce("foo1");

      // chooses which word gets the number
      randomizer.uniform.mockResolvedValueOnce(1);

      const result = await password.randomEffLongWords({
        numberOfWords: 2,
        separator: "",
        number: true,
        capitalize: false,
      });

      expect(result).toEqual("foofoo1");
      expect(randomizer.pickWord).toHaveBeenNthCalledWith(1, EFFLongWordList, {
        titleCase: false,
        number: false,
      });
      expect(randomizer.pickWord).toHaveBeenNthCalledWith(2, EFFLongWordList, {
        titleCase: false,
        number: true,
      });
    });

    it("includes a separator", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.randomEffLongWords({
        numberOfWords: 2,
        separator: "-",
        number: false,
        capitalize: false,
      });

      expect(result).toEqual("foo-foo");
    });
  });

  describe("generate", () => {
    it("processes password generation options", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.generate(
        { algorithm: Algorithm.password },
        {
          length: 10,
        },
      );

      expect(result.category).toEqual(Type.password);
    });

    it("processes passphrase generation options", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = await password.generate(
        { algorithm: Algorithm.passphrase },
        {
          numWords: 10,
        },
      );

      expect(result.category).toEqual(Type.password);
    });

    it("throws when it cannot recognize the options type", async () => {
      const password = new PasswordRandomizer(randomizer, Date.now);

      const result = password.generate({ algorithm: Algorithm.username }, {});

      await expect(result).rejects.toBeInstanceOf(Error);
    });
  });
});
