/**
 * include structuredClone in test environment.
 * @jest-environment ../../../../shared/test.environment.ts
 */
import { DefaultOptions, Forwarders } from "./constants";
import { UsernameGeneratorOptions } from "./generator-options";
import { getForwarderOptions, falsyDefault, forAllForwarders } from "./utilities";

const TestOptions: UsernameGeneratorOptions = {
  type: "word",
  website: "example.com",
  word: {
    capitalize: true,
    includeNumber: true,
  },
  subaddress: {
    algorithm: "random",
    email: "foo@example.com",
  },
  catchall: {
    algorithm: "random",
    domain: "example.com",
  },
  forwarders: {
    service: Forwarders.Fastmail.id,
    fastMail: {
      website: null,
      domain: "httpbin.com",
      prefix: "foo",
      token: "some-token",
    },
    addyIo: {
      website: null,
      baseUrl: "https://app.addy.io",
      domain: "example.com",
      token: "some-token",
    },
    forwardEmail: {
      website: null,
      token: "some-token",
      domain: "example.com",
    },
    simpleLogin: {
      website: null,
      baseUrl: "https://app.simplelogin.io",
      token: "some-token",
    },
    duckDuckGo: {
      website: null,
      token: "some-token",
    },
    firefoxRelay: {
      website: null,
      token: "some-token",
    },
  },
};

describe("Username Generation Options", () => {
  describe("forAllForwarders", () => {
    it("runs the function on every forwarder.", () => {
      const result = forAllForwarders(TestOptions, (_, id) => id);
      expect(result).toEqual([
        "anonaddy",
        "duckduckgo",
        "fastmail",
        "firefoxrelay",
        "forwardemail",
        "simplelogin",
      ]);
    });
  });

  describe("getForwarderOptions", () => {
    it("should return null for unsupported services", () => {
      expect(getForwarderOptions("unsupported", DefaultOptions)).toBeNull();
    });

    let options: UsernameGeneratorOptions = null;
    beforeEach(() => {
      options = structuredClone(TestOptions);
    });

    it.each([
      [TestOptions.forwarders.addyIo, "anonaddy"],
      [TestOptions.forwarders.duckDuckGo, "duckduckgo"],
      [TestOptions.forwarders.fastMail, "fastmail"],
      [TestOptions.forwarders.firefoxRelay, "firefoxrelay"],
      [TestOptions.forwarders.forwardEmail, "forwardemail"],
      [TestOptions.forwarders.simpleLogin, "simplelogin"],
    ])("should return an %s for %p", (forwarderOptions, service) => {
      const forwarder = getForwarderOptions(service, options);
      expect(forwarder).toEqual(forwarderOptions);
    });

    it("should return a reference to the forwarder", () => {
      const forwarder = getForwarderOptions("anonaddy", options);
      expect(forwarder).toBe(options.forwarders.addyIo);
    });
  });

  describe("falsyDefault", () => {
    it("should not modify values with truthy items", () => {
      const input = {
        a: "a",
        b: 1,
        d: [1],
      };

      const output = falsyDefault(input, {
        a: "b",
        b: 2,
        d: [2],
      });

      expect(output).toEqual(input);
    });

    it("should modify values with falsy items", () => {
      const input = {
        a: "",
        b: 0,
        c: false,
        d: [] as number[],
        e: [0] as number[],
        f: null as string,
        g: undefined as string,
      };

      const output = falsyDefault(input, {
        a: "a",
        b: 1,
        c: true,
        d: [1],
        e: [1],
        f: "a",
        g: "a",
      });

      expect(output).toEqual({
        a: "a",
        b: 1,
        c: true,
        d: [1],
        e: [1],
        f: "a",
        g: "a",
      });
    });

    it("should traverse nested objects", () => {
      const input = {
        a: {
          b: {
            c: "",
          },
        },
      };

      const output = falsyDefault(input, {
        a: {
          b: {
            c: "c",
          },
        },
      });

      expect(output).toEqual({
        a: {
          b: {
            c: "c",
          },
        },
      });
    });

    it("should add missing defaults", () => {
      const input = {};

      const output = falsyDefault(input, {
        a: "a",
        b: [1],
        c: {},
        d: { e: 1 },
      });

      expect(output).toEqual({
        a: "a",
        b: [1],
        c: {},
        d: { e: 1 },
      });
    });

    it("should ignore missing defaults", () => {
      const input = {
        a: "",
        b: 0,
        c: false,
        d: [] as number[],
        e: [0] as number[],
        f: null as string,
        g: undefined as string,
      };

      const output = falsyDefault(input, {});

      expect(output).toEqual({
        a: "",
        b: 0,
        c: false,
        d: [] as number[],
        e: [0] as number[],
        f: null as string,
        g: undefined as string,
      });
    });

    it.each([[null], [undefined]])("should ignore %p defaults", (defaults) => {
      const input = {
        a: "",
        b: 0,
        c: false,
        d: [] as number[],
        e: [0] as number[],
        f: null as string,
        g: undefined as string,
      };

      const output = falsyDefault(input, defaults);

      expect(output).toEqual({
        a: "",
        b: 0,
        c: false,
        d: [] as number[],
        e: [0] as number[],
        f: null as string,
        g: undefined as string,
      });
    });
  });
});
