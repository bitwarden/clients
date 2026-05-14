import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { RouterService } from "../../../core/router.service";

import { PremiumCheckoutCancelComponent } from "./premium-checkout-cancel.component";

describe("PremiumCheckoutCancelComponent", () => {
  let fixture: ComponentFixture<PremiumCheckoutCancelComponent>;

  let authService: MockProxy<AuthService>;
  let i18nService: MockProxy<I18nService>;
  let router: MockProxy<Router>;
  let routerService: MockProxy<RouterService>;
  let activeAccountStatus$: BehaviorSubject<AuthenticationStatus>;

  async function setup(status: AuthenticationStatus) {
    activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(status);
    authService.activeAccountStatus$ = activeAccountStatus$;

    fixture = TestBed.createComponent(PremiumCheckoutCancelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    authService = mock<AuthService>();
    i18nService = mock<I18nService>();
    router = mock<Router>();
    routerService = mock<RouterService>();

    i18nService.t.mockImplementation((key) => key);

    TestBed.configureTestingModule({
      imports: [PremiumCheckoutCancelComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: I18nService, useValue: i18nService },
        { provide: Router, useValue: router },
        { provide: RouterService, useValue: routerService },
      ],
    });
  });

  describe("when the user is logged out", () => {
    beforeEach(async () => {
      await setup(AuthenticationStatus.LoggedOut);
    });

    it("renders the heading", () => {
      const heading = fixture.nativeElement.querySelector("h1");
      expect(heading?.textContent).toContain("checkoutCanceled");
    });

    it("renders the body copy", () => {
      const body = fixture.nativeElement.querySelector("p");
      expect(body?.textContent).toContain("checkoutCanceledMessage");
    });

    it("renders the return-to-bitwarden CTA", () => {
      const button = fixture.nativeElement.querySelector(
        "[data-testid='return-to-bitwarden-button']",
      );
      expect(button).not.toBeNull();
    });

    it("persists the redirect URL and navigates to /login when the CTA is clicked", async () => {
      const button = fixture.nativeElement.querySelector(
        "[data-testid='return-to-bitwarden-button']",
      ) as HTMLButtonElement;
      button.click();
      await fixture.whenStable();

      expect(routerService.persistLoginRedirectUrl).toHaveBeenCalledWith("/vault");
      expect(router.navigate).toHaveBeenCalledWith(["/login"]);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe("when the user is locked", () => {
    beforeEach(async () => {
      await setup(AuthenticationStatus.Locked);
    });

    it("renders the return-to-bitwarden CTA", () => {
      const button = fixture.nativeElement.querySelector(
        "[data-testid='return-to-bitwarden-button']",
      );
      expect(button).not.toBeNull();
    });

    it("persists the redirect URL and navigates to /lock when the CTA is clicked", async () => {
      const button = fixture.nativeElement.querySelector(
        "[data-testid='return-to-bitwarden-button']",
      ) as HTMLButtonElement;
      button.click();
      await fixture.whenStable();

      expect(routerService.persistLoginRedirectUrl).toHaveBeenCalledWith("/vault");
      expect(router.navigate).toHaveBeenCalledWith(["/lock"]);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe("when the user is unlocked", () => {
    beforeEach(async () => {
      await setup(AuthenticationStatus.Unlocked);
    });

    it("renders the return-to-bitwarden CTA", () => {
      const button = fixture.nativeElement.querySelector(
        "[data-testid='return-to-bitwarden-button']",
      );
      expect(button).not.toBeNull();
    });

    it("navigates directly to /vault when the CTA is clicked", async () => {
      const button = fixture.nativeElement.querySelector(
        "[data-testid='return-to-bitwarden-button']",
      ) as HTMLButtonElement;
      button.click();
      await fixture.whenStable();

      expect(router.navigateByUrl).toHaveBeenCalledWith("/vault");
      expect(routerService.persistLoginRedirectUrl).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
