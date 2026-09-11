import type { AbstractControl } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { urlSafetyValidator } from "./forwarder-base-url.validator";

function control(value: string): AbstractControl {
  return { value } as AbstractControl;
}

describe("urlSafetyValidator", () => {
  const i18nService = mock<I18nService>();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns null for an empty control value", () => {
    const validator = urlSafetyValidator(i18nService);

    const result = validator(control(""));

    expect(result).toBeNull();
  });

  it("returns null for a safe https url", () => {
    const validator = urlSafetyValidator(i18nService);

    const result = validator(control("https://example.com"));

    expect(result).toBeNull();
  });

  it("returns an unsafeUrl error with a localized message for a non-https url", () => {
    i18nService.t.mockReturnValue("This URL isn't allowed.");
    const validator = urlSafetyValidator(i18nService);

    const result = validator(control("http://example.com"));

    expect(result).toEqual({ unsafeUrl: { code: "scheme", message: "This URL isn't allowed." } });
    expect(i18nService.t).toHaveBeenCalledWith("forwarderUnsafeUrl");
  });

  it("returns an unsafeUrl error for a url targeting a restricted host", () => {
    i18nService.t.mockReturnValue("This URL isn't allowed.");
    const validator = urlSafetyValidator(i18nService);

    const result = validator(control("https://169.254.169.254"));

    expect(result).toEqual({ unsafeUrl: { code: "host", message: "This URL isn't allowed." } });
  });

  it("uses a different message and code for a malformed url than for an unsafe one", () => {
    i18nService.t.mockReturnValue("Enter a full URL, starting with https://.");
    const validator = urlSafetyValidator(i18nService);

    const result = validator(control("not-a-url"));

    expect(result).toEqual({
      unsafeUrl: { code: "invalid", message: "Enter a full URL, starting with https://." },
    });
    expect(i18nService.t).toHaveBeenCalledWith("forwarderMalformedUrl");
  });

  describe("isOverridden", () => {
    it("returns null for a non-https url when overridden", () => {
      const validator = urlSafetyValidator(i18nService, () => true);

      const result = validator(control("http://192.168.1.50"));

      expect(result).toBeNull();
    });

    it("returns null for a restricted host when overridden", () => {
      const validator = urlSafetyValidator(i18nService, () => true);

      const result = validator(control("https://169.254.169.254"));

      expect(result).toBeNull();
    });

    it("still rejects a malformed url even when overridden", () => {
      i18nService.t.mockReturnValue("Enter a full URL, starting with https://.");
      const validator = urlSafetyValidator(i18nService, () => true);

      const result = validator(control("not-a-url"));

      expect(result).toEqual({
        unsafeUrl: { code: "invalid", message: "Enter a full URL, starting with https://." },
      });
    });

    it("still rejects an unsafe url when not overridden", () => {
      i18nService.t.mockReturnValue("This URL isn't allowed.");
      const validator = urlSafetyValidator(i18nService, () => false);

      const result = validator(control("http://192.168.1.50"));

      expect(result).toEqual({ unsafeUrl: { code: "scheme", message: "This URL isn't allowed." } });
    });
  });
});
