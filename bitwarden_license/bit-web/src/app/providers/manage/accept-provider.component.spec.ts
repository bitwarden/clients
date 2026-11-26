import { CommonModule } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ProviderUserAcceptRequest } from "@bitwarden/common/provider";
import { IconComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AcceptProviderComponent } from "./accept-provider.component";

const inviteParams: Params = {
  providerId: "provider-1",
  providerUserId: "provider-user-1",
  token: "invite-token",
  email: "jane@example.com",
  providerName: "Acme MSP",
};

describe("AcceptProviderComponent", () => {
  let fixture: ComponentFixture<AcceptProviderComponent>;
  let apiService: MockProxy<ApiService>;
  let authService: MockProxy<AuthService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let router: MockProxy<Router>;
  let route: MockProxy<ActivatedRoute>;

  beforeEach(() => {
    apiService = mock<ApiService>();
    authService = mock<AuthService>();
    platformUtilsService = mock<PlatformUtilsService>();
    router = mock<Router>();
    route = mock<ActivatedRoute>();

    const i18nService = mock<I18nService>();
    // Assertions use the i18n key (plus any params), so no English text is assumed.
    i18nService.t.mockImplementation((key: string, ...params: (string | number | undefined)[]) =>
      [key, ...params].filter((p) => p != null).join(" "),
    );
    router.navigate.mockResolvedValue(true);
    apiService.postProviderUserAccept.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [AcceptProviderComponent],
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: ApiService, useValue: apiService },
        { provide: AuthService, useValue: authService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: I18nService, useValue: i18nService },
        { provide: Router, useValue: router },
      ],
    }).overrideComponent(AcceptProviderComponent, {
      set: { imports: [CommonModule, IconComponent, I18nPipe], schemas: [NO_ERRORS_SCHEMA] },
    });
  });

  // Observables must be assigned after mock(); mock({ queryParams: of() }) never emits.
  async function render(status: AuthenticationStatus, queryParams: Params = inviteParams) {
    authService.activeAccountStatus$ = of(status);
    route.queryParams = of(queryParams);

    fixture = TestBed.createComponent(AcceptProviderComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? "";
  }

  function button(label: string): HTMLElement | undefined {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>("a, button"),
    ).find((el) => el.textContent?.trim() === label);
  }

  describe("logged out", () => {
    it("replaces the spinner with the invitation details and the log in / create account actions", async () => {
      await render(AuthenticationStatus.LoggedOut);

      expect(fixture.nativeElement.querySelector(".bwi-spinner")).toBeNull();
      expect(text()).toContain("Acme MSP");
      expect(text()).toContain("jane@example.com");
      expect(text()).toContain("joinProviderDesc");
      expect(button("logIn")).toBeDefined();
      expect(button("createAccount")).toBeDefined();
    });

    it("does not call the accept API", async () => {
      await render(AuthenticationStatus.LoggedOut);

      expect(apiService.postProviderUserAccept).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("sends the invite details to finish-signup when creating an account", async () => {
      await render(AuthenticationStatus.LoggedOut);

      button("createAccount")!.click();
      await fixture.whenStable();

      expect(router.navigate).toHaveBeenCalledWith(["/finish-signup"], {
        queryParams: {
          email: "jane@example.com",
          providerUserId: "provider-user-1",
          providerInviteToken: "invite-token",
        },
      });
    });
  });

  describe("logged in", () => {
    it("accepts the invitation, shows the success toast and goes to the vault", async () => {
      await render(AuthenticationStatus.Unlocked);

      expect(apiService.postProviderUserAccept).toHaveBeenCalledWith(
        "provider-1",
        "provider-user-1",
        expect.any(ProviderUserAcceptRequest),
      );
      expect(apiService.postProviderUserAccept.mock.calls[0][2].token).toBe("invite-token");
      expect(platformUtilsService.showToast).toHaveBeenCalledWith(
        "success",
        "inviteAccepted",
        "providerInviteAcceptedDesc",
        { timeout: 10000 },
      );
      expect(router.navigate).toHaveBeenCalledWith(["/vault"]);
    });

    it("shows the server error and leaves the page when accepting fails", async () => {
      apiService.postProviderUserAccept.mockRejectedValue(new Error("boom"));

      await render(AuthenticationStatus.Unlocked);

      expect(platformUtilsService.showToast).toHaveBeenCalledWith(
        "error",
        null,
        "inviteAcceptFailedShort boom",
        { timeout: 10000 },
      );
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
      expect(router.navigate).not.toHaveBeenCalledWith(["/vault"]);
    });
  });

  it("shows the provider-specific error and leaves the page when the link is missing a required parameter", async () => {
    const withoutToken: Params = { ...inviteParams };
    delete withoutToken.token;

    await render(AuthenticationStatus.LoggedOut, withoutToken);

    expect(apiService.postProviderUserAccept).not.toHaveBeenCalled();
    expect(platformUtilsService.showToast).toHaveBeenCalledWith(
      "error",
      null,
      "providerInviteAcceptFailed",
      { timeout: 10000 },
    );
    expect(router.navigate).toHaveBeenCalledWith(["/"]);
  });
});
