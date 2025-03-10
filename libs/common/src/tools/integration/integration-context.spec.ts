import { mock } from "jest-mock-extended";

import { I18nService } from "../../platform/abstractions/i18n.service";

import { IntegrationContext } from "./integration-context";
import { IntegrationId } from "./integration-id";
import { IntegrationMetadata } from "./integration-metadata";

const EXAMPLE_META = Object.freeze({
  // arbitrary
  id: "simplelogin" as IntegrationId,
  name: "Example",
  // arbitrary
  extends: ["forwarder"],
  baseUrl: "https://api.example.com",
  selfHost: "maybe",
} as IntegrationMetadata);

describe("IntegrationContext", () => {
  const i18n = mock<I18nService>();

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("baseUrl", () => {
    it("outputs the base url from metadata", () => {
      const context = new IntegrationContext(EXAMPLE_META, null, i18n);

      const result = context.baseUrl();

      expect(result).toBe("https://api.example.com");
    });

    it("throws when the baseurl isn't defined in metadata", () => {
      const noBaseUrl: IntegrationMetadata = {
        id: "simplelogin" as IntegrationId, // arbitrary
        name: "Example",
        extends: ["forwarder"], // arbitrary
        selfHost: "maybe",
      };
      i18n.t.mockReturnValue("error");

      const context = new IntegrationContext(noBaseUrl, null, i18n);

      expect(() => context.baseUrl()).toThrow("error");
    });

    it("reads from the settings", () => {
      const context = new IntegrationContext(EXAMPLE_META, { baseUrl: "httpbin.org" }, i18n);

      const result = context.baseUrl();

      expect(result).toBe("httpbin.org");
    });

    it("ignores settings when selfhost is 'never'", () => {
      const selfHostNever: IntegrationMetadata = {
        id: "simplelogin" as IntegrationId, // arbitrary
        name: "Example",
        extends: ["forwarder"], // arbitrary
        baseUrl: "example.com",
        selfHost: "never",
      };
      const context = new IntegrationContext(selfHostNever, { baseUrl: "httpbin.org" }, i18n);

      const result = context.baseUrl();

      expect(result).toBe("example.com");
    });

    it("always reads the settings when selfhost is 'always'", () => {
      const selfHostAlways: IntegrationMetadata = {
        id: "simplelogin" as IntegrationId, // arbitrary
        name: "Example",
        extends: ["forwarder"], // arbitrary
        baseUrl: "example.com",
        selfHost: "always",
      };
      const context = new IntegrationContext(selfHostAlways, { baseUrl: "http.bin" }, i18n);

      // expect success
      const result = context.baseUrl();
      expect(result).toBe("http.bin");
    });

    it("fails when the settings are empty and selfhost is 'always'", () => {
      const selfHostAlways: IntegrationMetadata = {
        id: "simplelogin" as IntegrationId, // arbitrary
        name: "Example",
        extends: ["forwarder"], // arbitrary
        baseUrl: "example.com",
        selfHost: "always",
      };
      const context = new IntegrationContext(selfHostAlways, {}, i18n);

      // expect error
      i18n.t.mockReturnValue("error");
      expect(() => context.baseUrl()).toThrow("error");
    });

    it("reads from the metadata by default when selfhost is 'maybe'", () => {
      const selfHostMaybe: IntegrationMetadata = {
        id: "simplelogin" as IntegrationId, // arbitrary
        name: "Example",
        extends: ["forwarder"], // arbitrary
        baseUrl: "example.com",
        selfHost: "maybe",
      };

      const context = new IntegrationContext(selfHostMaybe, null, i18n);

      const result = context.baseUrl();

      expect(result).toBe("example.com");
    });

    it("overrides the metadata when selfhost is 'maybe'", () => {
      const selfHostMaybe: IntegrationMetadata = {
        id: "simplelogin" as IntegrationId, // arbitrary
        name: "Example",
        extends: ["forwarder"], // arbitrary
        baseUrl: "example.com",
        selfHost: "maybe",
      };

      const context = new IntegrationContext(selfHostMaybe, { baseUrl: "httpbin.org" }, i18n);

      const result = context.baseUrl();

      expect(result).toBe("httpbin.org");
    });
  });

  describe("authenticationToken", () => {
    it("reads from the settings", () => {
      const context = new IntegrationContext(EXAMPLE_META, { token: "example" }, i18n);

      const result = context.authenticationToken();

      expect(result).toBe("example");
    });

    it("suffix is appended to the token", () => {
      const context = new IntegrationContext(EXAMPLE_META, { token: "example" }, i18n);

      const result = context.authenticationToken({ suffix: " with suffix" });

      expect(result).toBe("example with suffix");
    });

    it("base64 encodes the read value", () => {
      const context = new IntegrationContext(EXAMPLE_META, { token: "example" }, i18n);

      const result = context.authenticationToken({ base64: true });

      expect(result).toBe("ZXhhbXBsZQ==");
    });

    it("throws an error when the value is missing", () => {
      const context = new IntegrationContext(EXAMPLE_META, {}, i18n);
      i18n.t.mockReturnValue("error");

      expect(() => context.authenticationToken()).toThrow("error");
    });

    it.each([[undefined], [null], [""]])("throws an error when the value is %p", (token) => {
      const context = new IntegrationContext(EXAMPLE_META, { token }, i18n);
      i18n.t.mockReturnValue("error");

      expect(() => context.authenticationToken()).toThrow("error");
    });
  });

  describe("website", () => {
    it("returns the website", () => {
      const context = new IntegrationContext(EXAMPLE_META, null, i18n);

      const result = context.website({ website: "www.example.com" });

      expect(result).toBe("www.example.com");
    });

    it("returns an empty string when the website is not specified", () => {
      const context = new IntegrationContext(EXAMPLE_META, null, i18n);

      const result = context.website({ website: undefined });

      expect(result).toBe("");
    });
  });

  describe("generatedBy", () => {
    it("creates generated by text", () => {
      const context = new IntegrationContext(EXAMPLE_META, null, i18n);
      i18n.t.mockReturnValue("result");

      const result = context.generatedBy({ website: null });

      expect(result).toBe("result");
      expect(i18n.t).toHaveBeenCalledWith("forwarderGeneratedBy", "");
    });

    it("creates generated by text including the website", () => {
      const context = new IntegrationContext(EXAMPLE_META, null, i18n);
      i18n.t.mockReturnValue("result");

      const result = context.generatedBy({ website: "www.example.com" });

      expect(result).toBe("result");
      expect(i18n.t).toHaveBeenCalledWith("forwarderGeneratedByWithWebsite", "www.example.com");
    });
  });
});
