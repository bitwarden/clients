import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { Vfo1TerminologyService } from "../services/vfo1-terminology.service";

import { Vfo1I18nPipe } from "./vfo1-i18n.pipe";

describe("Vfo1I18nPipe", () => {
  let i18nService: MockProxy<I18nService>;
  let enabledFn: jest.Mock<boolean, []>;
  let pipe: Vfo1I18nPipe;

  beforeEach(() => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    enabledFn = jest.fn<boolean, []>().mockReturnValue(false);

    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: Vfo1TerminologyService, useValue: { enabled: enabledFn } },
        Vfo1I18nPipe,
      ],
    });

    pipe = TestBed.inject(Vfo1I18nPipe);
  });

  it("returns the legacy key translation when flag is off", () => {
    expect(pipe.transform("legacyKey", "newKey")).toBe("legacyKey");
    expect(i18nService.t).toHaveBeenCalledWith("legacyKey");
  });

  it("returns the new key translation when flag is on", () => {
    enabledFn.mockReturnValue(true);
    expect(pipe.transform("legacyKey", "newKey")).toBe("newKey");
    expect(i18nService.t).toHaveBeenCalledWith("newKey");
  });

  it("returns cached result on repeated call with same args", () => {
    pipe.transform("legacyKey", "newKey", "p");
    pipe.transform("legacyKey", "newKey", "p");
    expect(i18nService.t).toHaveBeenCalledTimes(1);
  });

  it("recomputes when the flag flips", () => {
    pipe.transform("legacyKey", "newKey");

    enabledFn.mockReturnValue(true);

    pipe.transform("legacyKey", "newKey");

    expect(i18nService.t).toHaveBeenCalledTimes(2);
    expect(i18nService.t).toHaveBeenNthCalledWith(2, "newKey");
  });

  it("passes params through to i18nService.t", () => {
    pipe.transform("legacyKey", "newKey", "a", 1);

    expect(i18nService.t).toHaveBeenCalledWith("legacyKey", "a", 1);
  });

  it("recomputes when params change", () => {
    pipe.transform("legacyKey", "newKey", "x");
    pipe.transform("legacyKey", "newKey", "y");

    expect(i18nService.t).toHaveBeenCalledTimes(2);
    expect(i18nService.t).toHaveBeenNthCalledWith(2, "legacyKey", "y");
  });
});
