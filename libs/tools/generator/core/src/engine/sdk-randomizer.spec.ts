import { SdkRandomNumberClient } from "@bitwarden/sdk-internal";

import { SdkRandomizer } from "./sdk-randomizer";

const mockGenRange = jest.fn();

jest.mock("@bitwarden/sdk-internal", () => ({
  SdkRandomNumberClient: jest.fn(),
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: {
    Ready: Promise.resolve(),
  },
}));

describe("SdkRandomizer", () => {
  beforeEach(() => {
    (SdkRandomNumberClient as jest.Mock).mockImplementation(() => ({
      gen_range: mockGenRange,
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("pick", () => {
    it.each([[null], [undefined], [[]]])("throws when the list is %p", async (list) => {
      const randomizer = new SdkRandomizer();

      await expect(() => randomizer.pick(list)).rejects.toBeInstanceOf(Error);

      expect.assertions(1);
    });

    it("picks an item from the list", async () => {
      const randomizer = new SdkRandomizer();
      mockGenRange.mockReturnValue(1);

      const result = await randomizer.pick([0, 1]);

      expect(result).toBe(1);
    });
  });

  describe("pickWord", () => {
    it.each([[null], [undefined], [[]]])("throws when the list is %p", async (list) => {
      const randomizer = new SdkRandomizer();

      await expect(() => randomizer.pickWord(list)).rejects.toBeInstanceOf(Error);

      expect.assertions(1);
    });

    it("picks a word from the list", async () => {
      const randomizer = new SdkRandomizer();
      mockGenRange.mockReturnValue(1);

      const result = await randomizer.pickWord(["foo", "bar"]);

      expect(result).toBe("bar");
    });

    it("capitalizes the word when options.titleCase is true", async () => {
      const randomizer = new SdkRandomizer();
      mockGenRange.mockReturnValue(1);

      const result = await randomizer.pickWord(["foo", "bar"], { titleCase: true });

      expect(result).toBe("Bar");
    });

    it("appends a random number when options.number is true", async () => {
      const randomizer = new SdkRandomizer();
      mockGenRange.mockReturnValueOnce(1);
      mockGenRange.mockReturnValueOnce(2);

      const result = await randomizer.pickWord(["foo", "bar"], { number: true });

      expect(result).toBe("bar2");
    });
  });

  describe("shuffle", () => {
    it.each([[null], [undefined], [[]]])("throws when the list is %p", async (list) => {
      const randomizer = new SdkRandomizer();

      await expect(() => randomizer.shuffle(list)).rejects.toBeInstanceOf(Error);

      expect.assertions(1);
    });

    it("returns a copy of the list without shuffling it when theres only one entry", async () => {
      const randomizer = new SdkRandomizer();

      const result = await randomizer.shuffle(["foo"]);

      expect(result).toEqual(["foo"]);
      expect(result).not.toBe(["foo"]);
      expect(mockGenRange).not.toHaveBeenCalled();
    });

    it("shuffles the tail of the list", async () => {
      const randomizer = new SdkRandomizer();
      mockGenRange.mockReturnValueOnce(0);

      const result = await randomizer.shuffle(["bar", "foo"]);

      expect(result).toEqual(["foo", "bar"]);
    });

    it("shuffles the list", async () => {
      const randomizer = new SdkRandomizer();
      mockGenRange.mockReturnValueOnce(0);
      mockGenRange.mockReturnValueOnce(1);

      const result = await randomizer.shuffle(["baz", "bar", "foo"]);

      expect(result).toEqual(["foo", "bar", "baz"]);
    });

    it("returns the input list when options.copy is false", async () => {
      const randomizer = new SdkRandomizer();
      mockGenRange.mockReturnValueOnce(0);

      const expectedResult = ["foo"];
      const result = await randomizer.shuffle(expectedResult, { copy: false });

      expect(result).toBe(expectedResult);
    });
  });

  describe("chars", () => {
    it("returns an empty string when the length is 0", async () => {
      const randomizer = new SdkRandomizer();

      const result = await randomizer.chars(0);

      expect(result).toEqual("");
    });

    it("returns an arbitrary lowercase ascii character", async () => {
      const randomizer = new SdkRandomizer();
      mockGenRange.mockReturnValueOnce(0);

      const result = await randomizer.chars(1);

      expect(result).toEqual("a");
    });

    it("returns a number of ascii characters based on the length", async () => {
      const randomizer = new SdkRandomizer();
      mockGenRange.mockReturnValue(0);

      const result = await randomizer.chars(2);

      expect(result).toEqual("aa");
      expect(mockGenRange).toHaveBeenCalledTimes(2);
    });

    it("returns a new random character each time its called", async () => {
      const randomizer = new SdkRandomizer();
      mockGenRange.mockReturnValueOnce(0);
      mockGenRange.mockReturnValueOnce(1);

      const resultA = await randomizer.chars(1);
      const resultB = await randomizer.chars(1);

      expect(resultA).toEqual("a");
      expect(resultB).toEqual("b");
      expect(mockGenRange).toHaveBeenCalledTimes(2);
    });
  });

  describe("uniform", () => {
    it("forwards requests to the crypto service", async () => {
      const randomizer = new SdkRandomizer();
      mockGenRange.mockReturnValue(5);

      const result = await randomizer.uniform(0, 5);

      expect(result).toBe(5);
      expect(mockGenRange).toHaveBeenCalledWith(0, 5);
    });
  });
});
