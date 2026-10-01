import { ChangeDetectionStrategy, Component, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

import { OnePasswordImportSummary } from "../../sdk";

import {
  ImportOnePasswordComponent,
  OnePasswordImportContext,
} from "./import-onepassword.component";
import { OnePasswordDirectImportService } from "./onepassword-direct-import.service";

@Component({
  template: `<form [formGroup]="form"><import-onepassword /></form>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ImportOnePasswordComponent],
})
class HostComponent {
  readonly form: FormGroup = new FormGroup({});
  readonly importer = viewChild.required(ImportOnePasswordComponent);
}

describe("ImportOnePasswordComponent", () => {
  const summary: OnePasswordImportSummary = {
    imported: { ciphers: [], folders: 1, collections: 0 },
    skipped_vaults: [],
    skipped_items: [],
  };
  const context: OnePasswordImportContext = {
    organizationId: undefined,
    selectedImportTarget: undefined,
    canAccessImportExport: false,
  };

  let fixture: ComponentFixture<HostComponent>;
  let directImportService: MockProxy<OnePasswordDirectImportService>;
  let toastService: MockProxy<ToastService>;
  let onImported: jest.Mock<Promise<void>, [OnePasswordImportSummary]>;

  beforeEach(async () => {
    directImportService = mock<OnePasswordDirectImportService>();
    toastService = mock<ToastService>();
    onImported = jest.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ToastService, useValue: toastService },
      ],
    })
      .overrideComponent(ImportOnePasswordComponent, {
        set: {
          providers: [{ provide: OnePasswordDirectImportService, useValue: directImportService }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  function options(): FormGroup {
    return fixture.componentInstance.form.controls["onepasswordOptions"] as FormGroup;
  }

  function fillIn(email = " user@example.com ", subdomain = "my") {
    options().setValue({ email, subdomain, domain: "Global" });
  }

  async function submit() {
    await fixture.componentInstance.importer().submitDirect(context, onImported);
    fixture.detectChanges();
  }

  function errors(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll("bit-error")).map(
      (error) => error.textContent?.trim() ?? "",
    );
  }

  it("does not import an incomplete form, and says what is missing", async () => {
    options().setValue({ email: "", subdomain: "", domain: "Global" });

    await submit();

    expect(directImportService.handleImport).not.toHaveBeenCalled();
    expect(errors()).toEqual(["emailIsRequired", "signInAddressIsRequired"]);
  });

  it.each([
    ["an email", "user@", "my", "enterValidEmailAddress"],
    ["a sign-in address", "user@example.com", "acme.1password.com", "enterValidSignInAddress"],
    ["a sign-in address", "user@example.com", "-acme", "enterValidSignInAddress"],
  ])("does not import %s the SDK would refuse", async (_, email, subdomain, error) => {
    fillIn(email, subdomain);

    await submit();

    expect(directImportService.handleImport).not.toHaveBeenCalled();
    expect(errors()).toEqual([error]);
  });

  it("imports the account that was entered and hands the summary over", async () => {
    directImportService.handleImport.mockResolvedValue(summary);
    fillIn(" user@example.com ", " Acme-Corp ");

    await submit();

    expect(directImportService.handleImport).toHaveBeenCalledWith(
      { email: "user@example.com", subdomain: "Acme-Corp", domain: "Global" },
      undefined,
      undefined,
      false,
    );
    expect(onImported).toHaveBeenCalledWith(summary);
  });

  it("does nothing more when the user cancels a prompt", async () => {
    directImportService.handleImport.mockResolvedValue(undefined);
    fillIn();

    await submit();

    expect(onImported).not.toHaveBeenCalled();
    expect(errors()).toEqual([]);
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it.each<["email" | "signInAddress", string, "email" | "subdomain", string]>([
    ["email", "Only login with password is supported.", "email", "other@example.com"],
    ["signInAddress", "Enter a valid sign-in address.", "subdomain", "acme"],
  ])(
    "marks a refused %s on its field until it changes",
    async (field, message, control, corrected) => {
      directImportService.handleImport.mockRejectedValueOnce(new Error("refused"));
      directImportService.describeError.mockReturnValue({ field, message });
      fillIn();

      await submit();

      expect(errors()).toEqual([message]);
      expect(toastService.showToast).not.toHaveBeenCalled();

      await submit();
      expect(directImportService.handleImport).toHaveBeenCalledTimes(1);

      directImportService.handleImport.mockResolvedValueOnce(summary);
      options().controls[control].setValue(corrected);
      await submit();

      expect(errors()).toEqual([]);
      expect(onImported).toHaveBeenCalledWith(summary);
    },
  );

  it("shows any other failure in a toast and lets the same details be retried", async () => {
    directImportService.handleImport.mockRejectedValueOnce(new Error("offline"));
    directImportService.describeError.mockReturnValue({ message: "Try again" });
    fillIn();

    await submit();

    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "error",
      title: null,
      message: "Try again",
    });
    expect(errors()).toEqual([]);
    expect(fixture.componentInstance.form.valid).toBe(true);

    directImportService.handleImport.mockResolvedValueOnce(summary);
    await submit();

    expect(onImported).toHaveBeenCalledWith(summary);
  });
});
