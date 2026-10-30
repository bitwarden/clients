// IntersectionObserver is not available in JSDOM; mock it so DialogComponent scroll detection doesn't throw.
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
});

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import {
  OnePasswordSsoEnrollmentPromptComponent,
  OnePasswordSsoEnrollmentPromptData,
} from "./onepassword-sso-enrollment-prompt.component";

describe("OnePasswordSsoEnrollmentPromptComponent", () => {
  let fixture: ComponentFixture<OnePasswordSsoEnrollmentPromptComponent>;
  let submitCode: jest.Mock<Promise<void>, [string]>;

  const element = () => fixture.nativeElement as HTMLElement;
  const codeInput = () =>
    element().querySelector<HTMLInputElement>("#onepassword-sso-enrollment-prompt_input_code");
  const continueButton = () =>
    element().querySelector<HTMLButtonElement>(
      "#onepassword-sso-enrollment-prompt_button_continue",
    );
  const message = () => element().querySelector("p")?.textContent?.trim();

  function enterCode(code: string) {
    const input = codeInput()!;
    input.value = code;
    input.dispatchEvent(new Event("input"));
  }

  async function submit() {
    element().querySelector("form")!.dispatchEvent(new Event("submit"));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    submitCode = jest.fn().mockResolvedValue(undefined);
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [OnePasswordSsoEnrollmentPromptComponent],
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            email: "user@example.com",
            submitCode,
          } satisfies OnePasswordSsoEnrollmentPromptData,
        },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnePasswordSsoEnrollmentPromptComponent);
    fixture.detectChanges();
  });

  it("keeps Continue off while the field is blank", () => {
    expect(message()).toBe("onePasswordSsoVerifyInPendingSignIns");
    expect(codeInput()!.disabled).toBe(false);
    expect(continueButton()!.getAttribute("aria-disabled")).toBe("true");

    enterCode("123");
    fixture.detectChanges();

    expect(continueButton()!.hasAttribute("aria-disabled")).toBe(false);

    enterCode("");
    fixture.detectChanges();

    expect(continueButton()!.getAttribute("aria-disabled")).toBe("true");
  });

  it("shows no error for a blank field the user leaves", () => {
    codeInput()!.dispatchEvent(new Event("blur"));
    fixture.detectChanges();

    expect(element().querySelector("bit-error")).toBeNull();
  });

  it("hands over the code without spaces", async () => {
    enterCode(" ABCD - 1234 ");
    await submit();

    expect(submitCode).toHaveBeenCalledWith("ABCD-1234");
    expect(codeInput()!.disabled).toBe(false);
  });

  it("refuses a code that is only spaces", async () => {
    enterCode("   ");
    await submit();

    expect(submitCode).not.toHaveBeenCalled();
  });
});
