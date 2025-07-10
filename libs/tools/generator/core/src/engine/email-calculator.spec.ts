import { EmailCalculator } from "./email-calculator";

describe("EmailCalculator", () => {
  describe("appendToSubaddress", () => {
    it.each([[null], [undefined], [""]])(
      "returns an empty string when the website is %p",
      (website) => {
        const calculator = new EmailCalculator();

        const result = calculator.appendToSubaddress(website, null);

        expect(result).toEqual("");
      },
    );

    it.each([["noAtSymbol"], ["has spaces"]])(
      "returns the unaltered email address when it is invalid (=%p)",
      (email) => {
        const calculator = new EmailCalculator();

        const result = calculator.appendToSubaddress("foo", email);

        expect(result).toEqual(email);
      },
    );

    it("creates a subadress part", () => {
      const calculator = new EmailCalculator();

      const result = calculator.appendToSubaddress("baz", "foo@example.com");

      expect(result).toEqual("foo+baz@example.com");
    });

    it("appends to a subaddress part", () => {
      const calculator = new EmailCalculator();

      const result = calculator.appendToSubaddress("biz", "foo+bar@example.com");

      expect(result).toEqual("foo+barbiz@example.com");
    });
  });

  describe("concatenate", () => {
    it.each([[null], [undefined], [""]])("returns null when username is %p", (username) => {
      const calculator = new EmailCalculator();

      const result = calculator.concatenate(username, "");

      expect(result).toEqual(null);
    });

    it.each([[null], [undefined], [""]])("returns null when domain is %p", (domain) => {
      const calculator = new EmailCalculator();

      const result = calculator.concatenate("foo", domain);

      expect(result).toEqual(null);
    });

    it("appends the username to the domain", () => {
      const calculator = new EmailCalculator();

      const result = calculator.concatenate("foo", "example.com");

      expect(result).toEqual("foo@example.com");
    });
  });
});
