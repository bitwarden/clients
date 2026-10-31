import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AbstractControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

import {
  ImportOnePasswordComponent,
  OnePasswordImportContext,
} from "./import-onepassword.component";
import { OnePasswordDirectImportService } from "./onepassword-direct-import.service";
import { OnePasswordSsoBrowser } from "./onepassword-sso-browser";

@Component({
  template: `<import-onepassword [formGroup]="formGroup"></import-onepassword>`,
  imports: [ImportOnePasswordComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly formGroup = new FormGroup<Record<string, AbstractControl>>({});
}

describe("ImportOnePasswordComponent", () => {
  const passwordOnlyHint = "onePasswordEmailHintPasswordLoginOnly";

  const context: OnePasswordImportContext = {
    organizationId: undefined,
    selectedImportTarget: undefined,
    canAccessImportExport: false,
  };

  let fixture: ComponentFixture<HostComponent>;
  let directImportService: MockProxy<OnePasswordDirectImportService>;
  let toastService: MockProxy<ToastService>;

  function render(ssoSupported: boolean) {
    directImportService = mock<OnePasswordDirectImportService>();
    directImportService.signInMethod.mockResolvedValue("password");
    toastService = mock<ToastService>();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ToastService, useValue: toastService },
        { provide: OnePasswordSsoBrowser, useValue: { supported: ssoSupported } },
      ],
    });
    TestBed.overrideComponent(ImportOnePasswordComponent, {
      set: {
        providers: [{ provide: OnePasswordDirectImportService, useValue: directImportService }],
      },
    });

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function component(): ImportOnePasswordComponent {
    return fixture.debugElement.query(By.directive(ImportOnePasswordComponent)).componentInstance;
  }

  function options() {
    return fixture.componentInstance.formGroup.get("onepasswordOptions")!;
  }

  it("shows the password only hint only when the client does not support single sign-on", () => {
    expect(render(true).textContent).not.toContain(passwordOnlyHint);
    TestBed.resetTestingModule();
    expect(render(false).textContent).toContain(passwordOnlyHint);
  });

  it.each([true, false])("gives the email a single hint with SSO support %s", (ssoSupported) => {
    const emailField = render(ssoSupported).querySelector("bit-form-field")!;

    expect(emailField.querySelectorAll("bit-hint")).toHaveLength(1);
  });

  describe("on submit", () => {
    beforeEach(() => {
      render(true);
      options().patchValue({ email: " user@example.com ", subdomain: "team" });
    });

    it("asks how the entered account signs in", async () => {
      await component().submitDirect(context, jest.fn());

      expect(directImportService.signInMethod).toHaveBeenCalledWith({
        email: "user@example.com",
        subdomain: "team",
        domain: "Global",
      });
    });

    it("imports with the password when the account signs in with it", async () => {
      await component().submitDirect(context, jest.fn());

      expect(directImportService.handleImport).toHaveBeenCalled();
      expect(directImportService.handleSsoImport).not.toHaveBeenCalled();
    });

    it("imports with single sign-on when the account signs in with it", async () => {
      directImportService.signInMethod.mockResolvedValue("sso");

      await component().submitDirect(context, jest.fn());

      expect(directImportService.handleSsoImport).toHaveBeenCalled();
      expect(directImportService.handleImport).not.toHaveBeenCalled();
    });

    it("marks the email when the account cannot sign in on this client", async () => {
      directImportService.signInMethod.mockResolvedValue(undefined);

      await component().submitDirect(context, jest.fn());

      expect(options().get("email")!.getError("rejected")).toEqual({
        message: "onePasswordUnsupportedSignIn",
      });
      expect(directImportService.handleImport).not.toHaveBeenCalled();
      expect(directImportService.handleSsoImport).not.toHaveBeenCalled();
    });

    it("tells a client without single sign-on that only the password is supported", async () => {
      TestBed.resetTestingModule();
      render(false);
      options().patchValue({ email: "user@example.com", subdomain: "team" });
      directImportService.signInMethod.mockResolvedValue(undefined);

      await component().submitDirect(context, jest.fn());

      expect(options().get("email")!.getError("rejected")).toEqual({
        message: "onePasswordOnlyPasswordLoginTryAgain",
      });
    });

    it.each([
      ["email", "email"],
      ["signInAddress", "subdomain"],
    ] as const)("marks the %s 1Password refuses when asked", async (field, control) => {
      directImportService.signInMethod.mockRejectedValue(new Error("refused"));
      directImportService.describeError.mockReturnValue({ field, message: "refused" });

      await component().submitDirect(context, jest.fn());

      expect(options().get(control)!.hasError("rejected")).toBe(true);
      expect(directImportService.handleImport).not.toHaveBeenCalled();
    });

    it("shows any other failure to ask in a toast", async () => {
      directImportService.signInMethod.mockRejectedValue(new Error("offline"));
      directImportService.describeError.mockReturnValue({ message: "offline" });

      await component().submitDirect(context, jest.fn());

      expect(toastService.showToast).toHaveBeenCalledWith({ variant: "error", message: "offline" });
      expect(options().valid).toBe(true);
    });

    it("does not retry a refused email until it is changed", async () => {
      directImportService.handleImport.mockRejectedValueOnce(new Error("refused"));
      directImportService.describeError.mockReturnValueOnce({ field: "email", message: "refused" });
      await component().submitDirect(context, jest.fn());
      expect(options().get("email")!.hasError("rejected")).toBe(true);

      await component().submitDirect(context, jest.fn());
      expect(directImportService.signInMethod).toHaveBeenCalledTimes(1);

      options().patchValue({ email: "other@example.com" });
      expect(options().valid).toBe(true);
      await component().submitDirect(context, jest.fn());
      expect(directImportService.signInMethod).toHaveBeenCalledTimes(2);
    });
  });
});
