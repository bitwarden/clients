import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { activeAuthGuard } from "./active-auth.guard";

@Component({ template: "", standalone: false })
class EmptyComponent {}

describe("activeAuthGuard", () => {
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
            path: "protected-route",
            component: EmptyComponent,
            canActivate: [activeAuthGuard()],
          },
          { path: "login", component: EmptyComponent },
        ]),
      ],
      providers: [
        { provide: LoginStrategyServiceAbstraction, useValue: loginStrategyService },
        { provide: LogService, useValue: logService },
      ],
      declarations: [EmptyComponent],
    });

    return {
      router: testBed.inject(Router),
      logService,
      loginStrategyService,
    };
  };

  it("creates the guard", () => {
    const { router } = setup(AuthenticationType.Password);
    expect(router).toBeTruthy();
  });

  it("allows access with an active login session", async () => {
    const { router } = setup(AuthenticationType.Password);

    await router.navigate(["protected-route"]);
    expect(router.url).toBe("/protected-route");
  });

  it("redirects to login with no active session", async () => {
    const { router, logService } = setup(null);

    await router.navigate(["protected-route"]);
    expect(router.url).toBe("/login");
    expect(logService.error).toHaveBeenCalledWith("No active login session found.");
  });
});
