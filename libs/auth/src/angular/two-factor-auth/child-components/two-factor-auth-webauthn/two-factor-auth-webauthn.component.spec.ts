import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
// eslint-disable-next-line no-restricted-imports
import { ToastService } from "@bitwarden/components";

import { TwoFactorAuthWebAuthnComponentService } from "./two-factor-auth-webauthn-component.service";
import { TwoFactorAuthWebAuthnComponent } from "./two-factor-auth-webauthn.component";

describe("TwoFactorAuthWebAuthnComponent", () => {
  const providerData = { challenge: "AQID", rpId: "vault.example.com" };

  let fixture: ComponentFixture<TwoFactorAuthWebAuthnComponent>;
  let component: TwoFactorAuthWebAuthnComponent;
  let webAuthnComponentService: MockProxy<TwoFactorAuthWebAuthnComponentService>;
  let toastService: MockProxy<ToastService>;
  let results: { token: string; remember?: boolean }[];

  beforeEach(async () => {
    const platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.supportsWebAuthn.mockReturnValue(true);
    const twoFactorService = mock<TwoFactorService>();
    twoFactorService.getProviders.mockResolvedValue(
      new Map([[TwoFactorProviderType.WebAuthn, providerData]]),
    );
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);
    webAuthnComponentService = mock<TwoFactorAuthWebAuthnComponentService>();
    webAuthnComponentService.shouldOpenWebAuthnInNewTab.mockReturnValue(false);
    webAuthnComponentService.shouldAuthenticateInWindow.mockResolvedValue(true);
    toastService = mock<ToastService>();

    await TestBed.configureTestingModule({
      imports: [TwoFactorAuthWebAuthnComponent],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: WINDOW, useValue: window },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: TwoFactorService, useValue: twoFactorService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: ToastService, useValue: toastService },
        { provide: TwoFactorAuthWebAuthnComponentService, useValue: webAuthnComponentService },
        { provide: LogService, useValue: mock<LogService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TwoFactorAuthWebAuthnComponent);
    component = fixture.componentInstance;
    results = [];
    component.webAuthnResultEmitter.subscribe((result) => results.push(result));
    await component.ngOnInit();
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector("button");
  }

  async function clickButton() {
    button().click();
    // Let the provider lookup and the request settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe("in the window", () => {
    it("doesn't start the request until the user presses Continue", () => {
      expect(webAuthnComponentService.authenticateInWindow).not.toHaveBeenCalled();
      expect(button().textContent?.trim()).toBe("continue");
    });

    it("starts the request and returns its result when the user presses Continue", async () => {
      webAuthnComponentService.authenticateInWindow.mockResolvedValue("token");

      await clickButton();

      expect(webAuthnComponentService.authenticateInWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge: new Uint8Array([1, 2, 3]),
          rpId: "vault.example.com",
        }),
        window,
      );
      // The remember choice is read from the form when the result is submitted.
      expect(results).toEqual([{ token: "token" }]);
    });

    it("hides Continue while the result is being submitted, and shows it again after", async () => {
      webAuthnComponentService.authenticateInWindow.mockResolvedValue("token");
      await clickButton();

      fixture.componentRef.setInput("submitting", true);
      fixture.detectChanges();
      expect(button()).toBeNull();

      // The submission failed, e.g. the server rejected the token.
      fixture.componentRef.setInput("submitting", false);
      fixture.detectChanges();
      expect(button()?.textContent?.trim()).toBe("continue");
    });

    it("lets the user try again after the request fails", async () => {
      webAuthnComponentService.authenticateInWindow.mockRejectedValue(new Error("Cancelled"));

      await clickButton();

      expect(results).toEqual([]);
      expect(toastService.showToast).toHaveBeenCalled();
      expect(button().textContent?.trim()).toBe("tryAgain");
    });
  });
});
