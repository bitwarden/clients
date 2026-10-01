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

import {
  OnePasswordCredentialsPromptComponent,
  OnePasswordCredentialsRejection,
  OnePasswordSecretKeyAndPassword,
} from "./onepassword-credentials-prompt.component";

describe("OnePasswordCredentialsPromptComponent", () => {
  let fixture: ComponentFixture<OnePasswordCredentialsPromptComponent>;
  let dialogRef: MockProxy<DialogRef<undefined>>;
  let signIn: jest.Mock<
    Promise<OnePasswordCredentialsRejection | undefined>,
    [OnePasswordSecretKeyAndPassword]
  >;

  beforeEach(async () => {
    dialogRef = mock<DialogRef<undefined>>();
    dialogRef.disableClose = true;
    signIn = jest.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [OnePasswordCredentialsPromptComponent],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: { email: "user@example.com", signIn } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnePasswordCredentialsPromptComponent);
    fixture.detectChanges();
  });

  function element<T extends HTMLElement>(id: string): T {
    return (fixture.nativeElement as HTMLElement).querySelector(`#${id}`) as T;
  }

  function type(id: string, value: string) {
    const input = element<HTMLInputElement>(id);
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }

  function enter(secretKey: string, password: string) {
    type("onepassword-credentials-prompt_input_secret-key", secretKey);
    type("onepassword-credentials-prompt_input_password", password);
  }

  async function submit() {
    element<HTMLButtonElement>("onepassword-credentials-prompt_button_continue").click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function errors(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll("bit-error")).map(
      (error) => error.textContent?.trim() ?? "",
    );
  }

  it("names the account and signs in with the Secret Key and password", async () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("user@example.com");

    enter("A3-ABCDEF", "master password");
    await submit();

    expect(signIn).toHaveBeenCalledWith({ secretKey: "A3-ABCDEF", password: "master password" });
    expect(errors()).toEqual([]);
  });

  it("offers to reveal both the Secret Key and the password", () => {
    expect(element("onepassword-credentials-prompt_button_toggle-secret-key")).not.toBeNull();
    expect(element("onepassword-credentials-prompt_button_toggle-password")).not.toBeNull();
  });

  it("says which of the two is missing", async () => {
    await submit();

    expect(signIn).not.toHaveBeenCalled();
    expect(errors()).toEqual(["secretKeyIsRequired", "passwordIsRequired"]);
  });

  it("stays open on a click outside or Escape", () => {
    const dialogService = mock<DialogService>();
    const data = { email: "user@example.com", signIn };

    OnePasswordCredentialsPromptComponent.open(dialogService, data);

    expect(dialogService.open).toHaveBeenCalledWith(OnePasswordCredentialsPromptComponent, {
      data,
      disableClose: true,
    });
  });

  it("cannot be cancelled while signing in", async () => {
    let finish: () => void = () => {};
    signIn.mockReturnValue(new Promise((resolve) => (finish = () => resolve(undefined))));
    enter("A3-ABCDEF", "master password");

    element<HTMLButtonElement>("onepassword-credentials-prompt_button_continue").click();
    fixture.detectChanges();
    element<HTMLButtonElement>("onepassword-credentials-prompt_button_cancel").click();
    element<HTMLButtonElement>("onepassword-credentials-prompt_button_close").click();
    expect(dialogRef.close).not.toHaveBeenCalled();

    finish();
    await fixture.whenStable();
    fixture.detectChanges();
    element<HTMLButtonElement>("onepassword-credentials-prompt_button_cancel").click();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it("marks the field 1Password refused until the Secret Key or password changes", async () => {
    signIn.mockResolvedValueOnce({ field: "password", message: "Wrong password" });
    enter("A3-ABCDEF", "wrong password");
    await submit();

    expect(errors()).toEqual(["Wrong password"]);

    await submit();
    expect(signIn).toHaveBeenCalledTimes(1);

    enter("A3-GHIJKL", "wrong password");
    await submit();

    expect(signIn).toHaveBeenCalledTimes(2);
    expect(errors()).toEqual([]);
  });

  it.each(["cancel", "close"])("closes with nothing on %s", (button) => {
    element<HTMLButtonElement>(`onepassword-credentials-prompt_button_${button}`).click();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
