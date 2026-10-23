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

import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { OnePasswordSsoEnrollmentStatus } from "../../../sdk";

import {
  OnePasswordSsoEnrollmentPromptComponent,
  OnePasswordSsoEnrollmentPromptData,
} from "./onepassword-sso-enrollment-prompt.component";

describe("OnePasswordSsoEnrollmentPromptComponent", () => {
  let fixture: ComponentFixture<OnePasswordSsoEnrollmentPromptComponent>;
  let status: ReturnType<typeof signal<OnePasswordSsoEnrollmentStatus>>;
  let codeRequested: ReturnType<typeof signal<boolean>>;
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
    status = signal<OnePasswordSsoEnrollmentStatus>("WaitingForApproval");
    codeRequested = signal(false);
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
            status,
            codeRequested,
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

  it("asks for approval without a code until 1Password asks for one", () => {
    expect(message()).toBe("onePasswordSsoWaitingForApproval");
    expect(codeInput()).toBeNull();
    expect(continueButton()).toBeNull();
  });

  it("asks for the code once 1Password does", () => {
    codeRequested.set(true);
    fixture.detectChanges();

    expect(message()).toBe("onePasswordSsoEnterVerificationCode");
    expect(codeInput()).not.toBeNull();
    expect(continueButton()).not.toBeNull();
  });

  it("hands over the code without spaces", async () => {
    codeRequested.set(true);
    fixture.detectChanges();

    enterCode(" ABCD - 1234 ");
    await submit();

    expect(submitCode).toHaveBeenCalledWith("ABCD-1234");
  });

  it("refuses a code that is only spaces", async () => {
    codeRequested.set(true);
    fixture.detectChanges();

    enterCode("   ");
    await submit();

    expect(submitCode).not.toHaveBeenCalled();
  });

  it("shows the stage of the enrollment once the code is handed over", () => {
    codeRequested.set(true);
    status.set("ExchangingCredentials");
    fixture.detectChanges();

    expect(message()).toBe("onePasswordSsoExchangingCredentials");
    expect(codeInput()).toBeNull();
    expect(continueButton()).not.toBeNull();
  });
});
