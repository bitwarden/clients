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
import { DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";

import { OnePasswordTwoFactorPromptComponent } from "./onepassword-two-factor-prompt.component";

describe("OnePasswordTwoFactorPromptComponent", () => {
  let fixture: ComponentFixture<OnePasswordTwoFactorPromptComponent>;
  let dialogRef: MockProxy<DialogRef<undefined>>;
  let submitCode: jest.Mock<Promise<boolean>, [string]>;

  beforeEach(async () => {
    dialogRef = mock<DialogRef<undefined>>();
    dialogRef.disableClose = true;
    submitCode = jest.fn().mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [OnePasswordTwoFactorPromptComponent],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: { email: "user@example.com", submitCode } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnePasswordTwoFactorPromptComponent);
    fixture.detectChanges();
  });

  function element<T extends HTMLElement>(id: string): T {
    return (fixture.nativeElement as HTMLElement).querySelector(`#${id}`) as T;
  }

  function error(): string | undefined {
    return (fixture.nativeElement as HTMLElement).querySelector("bit-error")?.textContent?.trim();
  }

  async function enterCode(code: string) {
    const input = element<HTMLInputElement>("onepassword-two-factor-prompt_input_code");
    input.value = code;
    input.dispatchEvent(new Event("input"));
    element<HTMLButtonElement>("onepassword-two-factor-prompt_button_continue").click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it("names the account the code is for", () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("user@example.com");
    expect(error()).toBeUndefined();
  });

  it("hands over the entered code", async () => {
    await enterCode("123456");

    expect(submitCode).toHaveBeenCalledWith("123456");
    expect(error()).toBeUndefined();
  });

  it("hands over a pasted code without the spaces 1Password shows it with", async () => {
    await enterCode("123 456");

    expect(submitCode).toHaveBeenCalledWith("123456");
  });

  it("says the code is missing", async () => {
    await enterCode("");

    expect(submitCode).not.toHaveBeenCalled();
    expect(error()).toBe("verificationCodeRequired");
  });

  it("stays open on a click outside or Escape", () => {
    const dialogService = mock<DialogService>();
    const data = { email: "user@example.com", submitCode };

    OnePasswordTwoFactorPromptComponent.open(dialogService, data);

    expect(dialogService.open).toHaveBeenCalledWith(OnePasswordTwoFactorPromptComponent, {
      data,
      disableClose: true,
    });
  });

  it("cannot be cancelled while 1Password checks the code", async () => {
    let answer: (refused: boolean) => void = () => {};
    submitCode.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const input = element<HTMLInputElement>("onepassword-two-factor-prompt_input_code");
    input.value = "123456";
    input.dispatchEvent(new Event("input"));

    element<HTMLButtonElement>("onepassword-two-factor-prompt_button_continue").click();
    fixture.detectChanges();
    element<HTMLButtonElement>("onepassword-two-factor-prompt_button_cancel").click();
    element<HTMLButtonElement>("onepassword-two-factor-prompt_button_close").click();
    expect(dialogRef.close).not.toHaveBeenCalled();

    answer(true);
    await fixture.whenStable();
    fixture.detectChanges();
    element<HTMLButtonElement>("onepassword-two-factor-prompt_button_cancel").click();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it("marks a refused code until another one is entered", async () => {
    submitCode.mockResolvedValueOnce(true);
    await enterCode("111111");

    expect(error()).toBe("enterValidVerificationCode");

    await enterCode("111111");
    expect(submitCode).toHaveBeenCalledTimes(1);

    await enterCode("654321");
    expect(submitCode).toHaveBeenLastCalledWith("654321");
    expect(error()).toBeUndefined();
  });

  it.each(["cancel", "close"])("closes with nothing on %s", (button) => {
    element<HTMLButtonElement>(`onepassword-two-factor-prompt_button_${button}`).click();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
