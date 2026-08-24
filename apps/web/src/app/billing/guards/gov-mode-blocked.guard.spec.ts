import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { I18nMockService, ToastService } from "@bitwarden/components";

import { govModeBlockedGuard } from "./gov-mode-blocked.guard";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ template: "", standalone: false })
class EmptyComponent {}

describe("govModeBlockedGuard", () => {
  const userId = "user-id" as UserId;
  const guardedRoute = "create-organization";

  let govModeService: MockProxy<GovModeService>;
  let accountService: MockProxy<AccountService>;
  let toastService: MockProxy<ToastService>;
  let logService: MockProxy<LogService>;

  const setup = ({
    isGovMode = false,
    hasActiveAccount = true,
    redirectUrl,
  }: {
    isGovMode?: boolean;
    hasActiveAccount?: boolean;
    redirectUrl?: string;
  } = {}) => {
    govModeService = mock<GovModeService>();
    accountService = mock<AccountService>();
    toastService = mock<ToastService>();
    logService = mock<LogService>();

    govModeService.isGovMode$.mockReturnValue(of(isGovMode));
    accountService.activeAccount$ = of(hasActiveAccount ? ({ id: userId } as any) : null);

    const testBed = TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: "", component: EmptyComponent },
          {
            path: guardedRoute,
            component: EmptyComponent,
            canActivate: [
              redirectUrl == null ? govModeBlockedGuard() : govModeBlockedGuard(redirectUrl),
            ],
          },
          { path: "vault", component: EmptyComponent },
          { path: "elsewhere", component: EmptyComponent },
        ]),
      ],
      providers: [
        { provide: GovModeService, useValue: govModeService },
        { provide: AccountService, useValue: accountService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
        {
          provide: I18nService,
          useValue: new I18nMockService({ accessDenied: "Access denied." }),
        },
      ],
    });

    return { router: testBed.inject(Router) };
  };

  it("navigates normally when not in Gov mode", async () => {
    const { router } = setup({ isGovMode: false });

    await router.navigate([guardedRoute]);

    expect(router.url).toBe(`/${guardedRoute}`);
  });

  it("blocks and redirects to /vault when in Gov mode", async () => {
    const { router } = setup({ isGovMode: true });

    await router.navigate([guardedRoute]);

    expect(router.url).toBe("/vault");
  });

  it("redirects to the supplied url when in Gov mode", async () => {
    const { router } = setup({ isGovMode: true, redirectUrl: "/elsewhere" });

    await router.navigate([guardedRoute]);

    expect(router.url).toBe("/elsewhere");
  });

  it("shows an error toast when in Gov mode", async () => {
    const { router } = setup({ isGovMode: true });

    await router.navigate([guardedRoute]);

    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "error",
      title: undefined,
      message: "Access denied.",
    });
  });

  it("does not show a toast when not in Gov mode", async () => {
    const { router } = setup({ isGovMode: false });

    await router.navigate([guardedRoute]);

    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it("blocks deep links that carry query params", async () => {
    const { router } = setup({ isGovMode: true });

    await router.navigate([guardedRoute], {
      queryParams: { plan: "enterprise", product: "1", trialLength: "7" },
    });

    expect(router.url).toBe("/vault");
  });

  it("checks Gov mode for the active account", async () => {
    const { router } = setup({ isGovMode: true });

    await router.navigate([guardedRoute]);

    expect(govModeService.isGovMode$).toHaveBeenCalledWith(userId);
  });

  it("fails open and allows navigation when there is no active account", async () => {
    const { router } = setup({ isGovMode: true, hasActiveAccount: false });

    await router.navigate([guardedRoute]);

    expect(router.url).toBe(`/${guardedRoute}`);
    expect(govModeService.isGovMode$).not.toHaveBeenCalled();
    expect(logService.error).toHaveBeenCalled();
  });

  it("fails open and allows navigation when the gov mode check errors", async () => {
    const { router } = setup({ isGovMode: true });
    govModeService.isGovMode$.mockReturnValue(throwError(() => new Error("boom")));

    await router.navigate([guardedRoute]);

    expect(router.url).toBe(`/${guardedRoute}`);
    expect(logService.error).toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
  });
});
