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
  OnePasswordCredentialsPromptComponent,
  OnePasswordCredentialsPromptData,
  OnePasswordCredentialsPromptResult,
} from "./onepassword-credentials-prompt.component";

describe("OnePasswordCredentialsPromptComponent", () => {
  let fixture: ComponentFixture<OnePasswordCredentialsPromptComponent>;
  let dialogRef: MockProxy<DialogRef<OnePasswordCredentialsPromptResult | undefined>>;

  async function open(data: OnePasswordCredentialsPromptData) {
    dialogRef = mock<DialogRef<OnePasswordCredentialsPromptResult | undefined>>();
    dialogRef.disableClose = false;

    await TestBed.configureTestingModule({
      imports: [OnePasswordCredentialsPromptComponent],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: data },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnePasswordCredentialsPromptComponent);
    fixture.detectChanges();
  }

  function element<T extends HTMLElement>(id: string): T {
    return (fixture.nativeElement as HTMLElement).querySelector(`#${id}`) as T;
  }

  function type(id: string, value: string) {
    const input = element<HTMLInputElement>(id);
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }

  async function submit() {
    element<HTMLButtonElement>("onepassword-credentials-prompt_button_continue").click();
    await fixture.whenStable();
  }

  function callout(): string | undefined {
    return (fixture.nativeElement as HTMLElement).querySelector("bit-callout")?.textContent?.trim();
  }

  it("names the account and closes with the Secret Key and password", async () => {
    await open({ email: "user@example.com" });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("user@example.com");
    expect(callout()).toBeUndefined();

    type("onepassword-credentials-prompt_input_secret-key", "A3-ABCDEF");
    type("onepassword-credentials-prompt_input_password", "master password");
    await submit();

    expect(dialogRef.close).toHaveBeenCalledWith({
      secretKey: "A3-ABCDEF",
      password: "master password",
    });
  });

  it("stays open until both are entered", async () => {
    await open({ email: "user@example.com" });

    type("onepassword-credentials-prompt_input_password", "master password");
    await submit();

    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it("closes with nothing when cancelled", async () => {
    await open({ email: "user@example.com" });

    element<HTMLButtonElement>("onepassword-credentials-prompt_button_cancel").click();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it("shows why the previous attempt was refused", async () => {
    await open({ email: "user@example.com", error: "Wrong password or Secret Key" });

    expect(callout()).toContain("Wrong password or Secret Key");
  });
});
