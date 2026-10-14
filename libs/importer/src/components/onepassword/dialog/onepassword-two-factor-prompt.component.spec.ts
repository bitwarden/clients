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
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import {
  OnePasswordTwoFactorPromptComponent,
  OnePasswordTwoFactorPromptData,
} from "./onepassword-two-factor-prompt.component";

describe("OnePasswordTwoFactorPromptComponent", () => {
  let fixture: ComponentFixture<OnePasswordTwoFactorPromptComponent>;
  let dialogRef: MockProxy<DialogRef<string | undefined>>;

  async function open(data: OnePasswordTwoFactorPromptData) {
    dialogRef = mock<DialogRef<string | undefined>>();
    dialogRef.disableClose = false;

    await TestBed.configureTestingModule({
      imports: [OnePasswordTwoFactorPromptComponent],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: data },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnePasswordTwoFactorPromptComponent);
    fixture.detectChanges();
  }

  function element<T extends HTMLElement>(id: string): T {
    return (fixture.nativeElement as HTMLElement).querySelector(`#${id}`) as T;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? "";
  }

  async function enterCode(code: string) {
    const input = element<HTMLInputElement>("onepassword-two-factor-prompt_input_code");
    input.value = code;
    input.dispatchEvent(new Event("input"));
    element<HTMLButtonElement>("onepassword-two-factor-prompt_button_continue").click();
    await fixture.whenStable();
  }

  describe("on the first attempt", () => {
    beforeEach(() => open({ email: "user@example.com", previousCodeRejected: false }));

    it("names the account the code is for", () => {
      expect(text()).toContain("user@example.com");
      expect(text()).not.toContain("invalidVerificationCode");
    });

    it("closes with the entered code", async () => {
      await enterCode("123456");

      expect(dialogRef.close).toHaveBeenCalledWith("123456");
    });

    it("closes with a pasted code without the spaces 1Password shows it with", async () => {
      await enterCode("123 456");

      expect(dialogRef.close).toHaveBeenCalledWith("123456");
    });

    it("stays open until a code is entered", async () => {
      await enterCode("");

      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("closes with no code when cancelled, which cancels the import instead of sending an empty code", () => {
      element<HTMLButtonElement>("onepassword-two-factor-prompt_button_cancel").click();

      expect(dialogRef.close).toHaveBeenCalledWith(undefined);
    });
  });

  describe("after a refused code", () => {
    beforeEach(() => open({ email: "user@example.com", previousCodeRejected: true }));

    it("says the previous code was invalid", () => {
      expect(text()).toContain("invalidVerificationCode");
    });

    it("accepts a new code", async () => {
      await enterCode("654321");

      expect(dialogRef.close).toHaveBeenCalledWith("654321");
    });
  });
});
