import { mock, MockProxy } from "jest-mock-extended";

import { CredentialGeneratorService, PasswordGenerationOptions } from "@bitwarden/generator-core";

import { sitePasswordSettings } from "./site-password-settings";

jest.mock("./password-rules.json", () => ({
  "example.com": { "password-rules": "minlength: 8; required: [-_];" },
}));

describe("sitePasswordSettings", () => {
  let generatorService: MockProxy<CredentialGeneratorService>;
  const settings = { length: 16, customRequiredChars: "-_" } as PasswordGenerationOptions;

  beforeEach(() => {
    generatorService = mock<CredentialGeneratorService>();
  });

  it("returns the settings for the website's rules", async () => {
    generatorService.passwordRules.mockResolvedValue(settings);

    const result = await sitePasswordSettings("https://login.example.com/signup", generatorService);

    expect(generatorService.passwordRules).toHaveBeenCalledWith("minlength: 8; required: [-_];");
    expect(result).toEqual({ website: "example.com", settings });
  });

  it("returns null when the website has no rules", async () => {
    expect(await sitePasswordSettings("https://example.org", generatorService)).toBeNull();
    expect(generatorService.passwordRules).not.toHaveBeenCalled();
  });

  it("returns null when the rules can't be parsed", async () => {
    generatorService.passwordRules.mockResolvedValue(null);

    expect(await sitePasswordSettings("https://example.com", generatorService)).toBeNull();
  });
});
