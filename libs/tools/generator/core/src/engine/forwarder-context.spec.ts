/// SDK/WASM code relies on TextEncoder/TextDecoder being available globally
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextDecoder, TextEncoder });

import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ApiSettings } from "@bitwarden/common/tools/integration/rpc";

import { ForwarderConfiguration } from "./forwarder-configuration";
import { ForwarderContext } from "./forwarder-context";
import { EmailDomainSettings, EmailForwardToSettings, EmailPrefixSettings } from "./settings";

describe("ForwarderContext", () => {
  const i18n = mock<I18nService>({
    t(key: string) {
      return key;
    },
  });

  describe("emailDomain", () => {
    it("returns the domain", () => {
      const settings = mock<EmailDomainSettings & ApiSettings>({ domain: "example.com" });
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);

      const result = context.emailDomain();

      expect(result).toEqual("example.com");
    });

    it.each([[null], [undefined], [""]])("throws an error if the domain is %p", (domain) => {
      const settings = mock<EmailDomainSettings & ApiSettings>({ domain });
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);

      expect(() => context.emailDomain()).toThrow("forwarderNoDomain");
    });

    it("throws an error if the domain is not an enumerable member of settings", () => {
      const settings = {} as EmailDomainSettings & ApiSettings;
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);

      expect(() => context.emailDomain()).toThrow("forwarderNoDomain");
    });
  });

  describe("emailPrefix", () => {
    it("returns the prefix", () => {
      const settings = mock<EmailPrefixSettings & ApiSettings>({ prefix: "foo" });
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);

      const result = context.emailPrefix();

      expect(result).toEqual("foo");
    });

    it.each([[null], [undefined], [""]])("throws an error if the prefix is %p", (prefix) => {
      const settings = mock<EmailPrefixSettings & ApiSettings>({ prefix });
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);

      expect(() => context.emailPrefix()).toThrow("forwarderNoPrefix");
    });

    it("throws an error if the prefix is not an enumerable member of settings", () => {
      const settings = {} as EmailPrefixSettings & ApiSettings;
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);

      expect(() => context.emailPrefix()).toThrow("forwarderNoPrefix");
    });
  });

  describe("emailForwardTo", () => {
    it("returns the forward-to address", () => {
      const settings = mock<EmailForwardToSettings & ApiSettings>({
        forwardTo: "recipient@example.com",
      });
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);

      const result = context.emailForwardTo();

      expect(result).toEqual("recipient@example.com");
    });

    it.each([[null], [undefined], [""]])(
      "returns an empty string when the forward-to address is %p",
      (forwardTo) => {
        const settings = mock<EmailForwardToSettings & ApiSettings>({ forwardTo });
        const config = mock<ForwarderConfiguration<typeof settings>>();
        const context = new ForwarderContext(config, settings, i18n);

        const result = context.emailForwardTo();

        expect(result).toEqual("");
      },
    );

    it("returns an empty string when the forward-to address is not an enumerable member of settings", () => {
      const settings = {} as EmailForwardToSettings & ApiSettings;
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);

      const result = context.emailForwardTo();

      expect(result).toEqual("");
    });
  });

  describe("prefixEnabled", () => {
    it("returns true when prefix is set to the 'website' sentinel", () => {
      const settings = mock<EmailPrefixSettings & ApiSettings>({ prefix: "website" });
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);
      const result = context.prefixEnabled();
      expect(result).toBe(true);
    });
    it.each([[null], [undefined], [""]])("returns false when prefix is %p", (prefix) => {
      const settings = mock<EmailPrefixSettings & ApiSettings>({ prefix });
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);
      const result = context.prefixEnabled();
      expect(result).toBe(false);
    });
    it("returns false when prefix is not an enumerable member of settings", () => {
      const settings = {} as EmailPrefixSettings & ApiSettings;
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);
      const result = context.prefixEnabled();
      expect(result).toBe(false);
    });
    it("returns false when prefix is any non-'website' string", () => {
      const settings = mock<EmailPrefixSettings & ApiSettings>({ prefix: "some-other-value" });
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);
      const result = context.prefixEnabled();
      expect(result).toBe(false);
    });
  });

  describe("missingAccountIdCause", () => {
    it("returns the cause", () => {
      const settings = mock<EmailDomainSettings & ApiSettings>();
      const config = mock<ForwarderConfiguration<typeof settings>>();
      const context = new ForwarderContext(config, settings, i18n);

      const result = context.missingAccountIdCause();

      expect(result).toEqual("forwarderNoAccountId");
    });
  });
});
