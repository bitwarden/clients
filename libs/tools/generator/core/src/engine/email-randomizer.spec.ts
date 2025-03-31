import { mock } from "jest-mock-extended";

import { EFFLongWordList } from "@bitwarden/common/platform/misc/wordlist";

import { Randomizer } from "./abstractions";
import { EmailRandomizer } from "./email-randomizer";

describe("EmailRandomizer", () => {
  const randomizer = mock<Randomizer>();

  beforeEach(() => {
    randomizer.pickWord.mockResolvedValue("baz");

    // set to 8 characters since that's the default
    randomizer.chars.mockResolvedValue("aaaaaaaa");
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("subaddress", () => {
    it("returns an empty string if the generation length is 0", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomAsciiSubaddress("foo@example.com", { length: 0 });

      expect(result).toEqual("foo@example.com");
    });

    it("returns an empty string if the generation length is less than 0", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomAsciiSubaddress("foo@example.com", { length: -1 });

      expect(result).toEqual("foo@example.com");
    });

    it.each([[null], [undefined], [""]])(
      "returns an empty string if the email address is %p",
      async (email) => {
        const emailRandomizer = new EmailRandomizer(randomizer);

        const result = await emailRandomizer.randomAsciiSubaddress(email);

        expect(result).toEqual("");
      },
    );

    it("returns the input if the email address lacks a username", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomAsciiSubaddress("@example.com");

      expect(result).toEqual("@example.com");
    });

    it("returns the input if the email address lacks a domain", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomAsciiSubaddress("foo");

      expect(result).toEqual("foo");
    });

    it("generates an email address with a subaddress", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomAsciiSubaddress("foo@example.com");

      expect(result).toEqual("foo+aaaaaaaa@example.com");
    });

    it("extends the subaddress when it is provided", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomAsciiSubaddress("foo+bar@example.com");

      expect(result).toEqual("foo+baraaaaaaaa@example.com");
    });

    it("defaults to 8 random characters", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      await emailRandomizer.randomAsciiSubaddress("foo@example.com");

      expect(randomizer.chars).toHaveBeenCalledWith(8);
    });

    it("overrides the default length", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      await emailRandomizer.randomAsciiSubaddress("foo@example.com", { length: 1 });

      expect(randomizer.chars).toHaveBeenCalledWith(1);
    });
  });

  describe("randomAsciiCatchall", () => {
    it.each([[null], [undefined], [""]])("returns null if the domain is %p", async (domain) => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomAsciiCatchall(domain);

      expect(result).toBeNull();
    });

    it("returns null if the length is 0", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomAsciiCatchall("example.com", { length: 0 });

      expect(result).toBeNull();
    });

    it("returns null if the length is less than 0", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomAsciiCatchall("example.com", { length: -1 });

      expect(result).toBeNull();
    });

    it("generates a random catchall", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomAsciiCatchall("example.com");

      expect(result).toEqual("aaaaaaaa@example.com");
    });

    it("defaults to 8 random characters", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      await emailRandomizer.randomAsciiCatchall("example.com");

      expect(randomizer.chars).toHaveBeenCalledWith(8);
    });

    it("overrides the default length", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      await emailRandomizer.randomAsciiCatchall("example.com", { length: 1 });

      expect(randomizer.chars).toHaveBeenCalledWith(1);
    });
  });

  describe("randomWordsCatchall", () => {
    it.each([[null], [undefined], [""]])("returns null if the domain is %p", async (domain) => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomWordsCatchall(domain);

      expect(result).toBeNull();
    });

    it("returns null if the length is 0", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomWordsCatchall("example.com", { numberOfWords: 0 });

      expect(result).toBeNull();
    });

    it("returns null if the length is less than 0", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomWordsCatchall("example.com", {
        numberOfWords: -1,
      });

      expect(result).toBeNull();
    });

    it("generates a random word catchall", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const result = await emailRandomizer.randomWordsCatchall("example.com");

      expect(result).toEqual("baz@example.com");
    });

    it("defaults to 1 random word", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      await emailRandomizer.randomWordsCatchall("example.com");

      expect(randomizer.pickWord).toHaveBeenCalledTimes(1);
    });

    it("requests a titleCase word for lengths greater than 1", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);
      randomizer.pickWord.mockResolvedValueOnce("Biz");

      await emailRandomizer.randomWordsCatchall("example.com", { numberOfWords: 2 });

      expect(randomizer.pickWord).toHaveBeenNthCalledWith(1, EFFLongWordList, { titleCase: false });
      expect(randomizer.pickWord).toHaveBeenNthCalledWith(2, EFFLongWordList, { titleCase: true });
    });

    it("overrides the eff word list", async () => {
      const emailRandomizer = new EmailRandomizer(randomizer);

      const expectedWordList = ["some", "arbitrary", "words"];
      await emailRandomizer.randomWordsCatchall("example.com", { words: expectedWordList });

      expect(randomizer.pickWord).toHaveBeenCalledWith(expectedWordList, { titleCase: false });
    });
  });

  describe("generate", () => {
    it("processes catchall generation options", async () => {
      const email = new EmailRandomizer(randomizer);

      const result = await email.generate(
        {},
        {
          catchallDomain: "example.com",
        },
      );

      expect(result.category).toEqual("catchall");
    });

    it("processes subaddress generation options", async () => {
      const email = new EmailRandomizer(randomizer);

      const result = await email.generate(
        {},
        {
          subaddressEmail: "foo@example.com",
        },
      );

      expect(result.category).toEqual("subaddress");
    });

    it("throws when it cannot recognize the options type", async () => {
      const email = new EmailRandomizer(randomizer);

      const result = email.generate({}, {});

      await expect(result).rejects.toBeInstanceOf(Error);
    });
  });
});
