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

  it.each([["http://example.com"], ["https://169.254.169.254"], ["http://192.168.1.50"]])(
    "returns null for a well-formed but unsafe url (%s) — handled by the trust dialog, not form validation",
    (url) => {
      const validator = urlSafetyValidator(i18nService);

      const result = validator(control(url));

      expect(result).toBeNull();
      expect(i18nService.t).not.toHaveBeenCalled();
    },
  );

  it("returns an unsafeUrl error with a localized message for a malformed url", () => {
    i18nService.t.mockReturnValue("Enter a valid URL");
    const validator = urlSafetyValidator(i18nService);

    const result = validator(control("not-a-url"));

    expect(result).toEqual({ unsafeUrl: { code: "invalid", message: "Enter a valid URL" } });
    expect(i18nService.t).toHaveBeenCalledWith("forwarderMalformedUrl");
  });
});
