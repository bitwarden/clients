import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { EmptyComponent } from "@bitwarden/angular/platform/guard/feature-flag.guard.spec";
import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { newDeviceVerificationGuard } from "./new-device-verification.guard";

describe("NewDeviceVerificationGuard", () => {
  const setup = (authType: AuthenticationType | null) => {
    const loginStrategyService: MockProxy<LoginStrategyServiceAbstraction> =
      mock<LoginStrategyServiceAbstraction>();
    const currentAuthTypeSubject = new BehaviorSubject<AuthenticationType | null>(authType);
    loginStrategyService.currentAuthType$ = currentAuthTypeSubject;

    const logService: MockProxy<LogService> = mock<LogService>();

    const testBed = TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: "", component: EmptyComponent },
          {
            path: "device-verification",
            component: EmptyComponent,
            canActivate: [newDeviceVerificationGuard()],
          },
          { path: "login", component: EmptyComponent },
        ]),
      ],
      providers: [
        { provide: LoginStrategyServiceAbstraction, useValue: loginStrategyService },
        { provide: LogService, useValue: logService },
      ],
    });

    return {
      router: testBed.inject(Router),
      logService,
    };
  };

  it("creates the guard", () => {
    const { router } = setup(AuthenticationType.Password);
    expect(router).toBeTruthy();
  });

  it("allows access with an active login session", async () => {
    const { router } = setup(AuthenticationType.Password);

    await router.navigate(["device-verification"]);
    expect(router.url).toBe("/device-verification");
  });

  it("redirects to login with no active session", async () => {
    const { router, logService } = setup(null);

    await router.navigate(["device-verification"]);
    expect(router.url).toBe("/login");
    expect(logService.error).toHaveBeenCalledWith("No active login session found.");
  });
});
