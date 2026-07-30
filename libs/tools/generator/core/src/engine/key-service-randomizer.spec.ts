import { mock } from "jest-mock-extended";

import { KeyService } from "@bitwarden/key-management";

import { KeyServiceRandomizer } from "./key-service-randomizer";

describe("KeyServiceRandomizer", () => {
  const keyService = mock<KeyService>();

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("pick", () => {
    it.each([[null], [undefined], [[]]])("throws when the list is %p", async (list) => {
      const randomizer = new KeyServiceRandomizer(keyService);

      await expect(() => randomizer.pick(list)).rejects.toBeInstanceOf(Error);

      expect.assertions(1);
    });

    it("picks an item from the list", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);
      keyService.randomNumber.mockResolvedValue(1);

      const result = await randomizer.pick([0, 1]);

      expect(result).toBe(1);
    });
  });

  describe("pickWord", () => {
    it.each([[null], [undefined], [[]]])("throws when the list is %p", async (list) => {
      const randomizer = new KeyServiceRandomizer(keyService);

      await expect(() => randomizer.pickWord(list)).rejects.toBeInstanceOf(Error);

      expect.assertions(1);
    });

    it("picks a word from the list", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);
      keyService.randomNumber.mockResolvedValue(1);

      const result = await randomizer.pickWord(["foo", "bar"]);

      expect(result).toBe("bar");
    });

    it("capitalizes the word when options.titleCase is true", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);
      keyService.randomNumber.mockResolvedValue(1);

      const result = await randomizer.pickWord(["foo", "bar"], { titleCase: true });

      expect(result).toBe("Bar");
    });

    it("appends a random number when options.number is true", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);
      keyService.randomNumber.mockResolvedValueOnce(1);
      keyService.randomNumber.mockResolvedValueOnce(2);

      const result = await randomizer.pickWord(["foo", "bar"], { number: true });

      expect(result).toBe("bar2");
    });
  });

  describe("shuffle", () => {
    it.each([[null], [undefined], [[]]])("throws when the list is %p", async (list) => {
      const randomizer = new KeyServiceRandomizer(keyService);

      await expect(() => randomizer.shuffle(list)).rejects.toBeInstanceOf(Error);

      expect.assertions(1);
    });

    it("returns a copy of the list without shuffling it when theres only one entry", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);

      const result = await randomizer.shuffle(["foo"]);

      expect(result).toEqual(["foo"]);
      expect(result).not.toBe(["foo"]);
      expect(keyService.randomNumber).not.toHaveBeenCalled();
    });

    it("shuffles the tail of the list", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);
      keyService.randomNumber.mockResolvedValueOnce(0);

      const result = await randomizer.shuffle(["bar", "foo"]);

      expect(result).toEqual(["foo", "bar"]);
    });

    it("shuffles the list", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);
      keyService.randomNumber.mockResolvedValueOnce(0);
      keyService.randomNumber.mockResolvedValueOnce(1);

      const result = await randomizer.shuffle(["baz", "bar", "foo"]);

      expect(result).toEqual(["foo", "bar", "baz"]);
    });

    it("returns the input list when options.copy is false", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);
      keyService.randomNumber.mockResolvedValueOnce(0);

      const expectedResult = ["foo"];
      const result = await randomizer.shuffle(expectedResult, { copy: false });

      expect(result).toBe(expectedResult);
    });
  });

  describe("chars", () => {
    it("returns an empty string when the length is 0", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);

      const result = await randomizer.chars(0);

      expect(result).toEqual("");
    });

    it("returns an arbitrary lowercase ascii character", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);
      keyService.randomNumber.mockResolvedValueOnce(0);

      const result = await randomizer.chars(1);

      expect(result).toEqual("a");
    });

    it("returns a number of ascii characters based on the length", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);
      keyService.randomNumber.mockResolvedValue(0);

      const result = await randomizer.chars(2);

      expect(result).toEqual("aa");
      expect(keyService.randomNumber).toHaveBeenCalledTimes(2);
    });

    it("returns a new random character each time its called", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);
      keyService.randomNumber.mockResolvedValueOnce(0);
      keyService.randomNumber.mockResolvedValueOnce(1);

      const resultA = await randomizer.chars(1);
      const resultB = await randomizer.chars(1);

      expect(resultA).toEqual("a");
      expect(resultB).toEqual("b");
      expect(keyService.randomNumber).toHaveBeenCalledTimes(2);
    });
  });

  describe("uniform", () => {
    it("forwards requests to the crypto service", async () => {
      const randomizer = new KeyServiceRandomizer(keyService);
      keyService.randomNumber.mockResolvedValue(5);

      const result = await randomizer.uniform(0, 5);

      expect(result).toBe(5);
      expect(keyService.randomNumber).toHaveBeenCalledWith(0, 5);
    });
  });
});
