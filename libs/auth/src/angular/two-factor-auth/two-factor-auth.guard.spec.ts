import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";

import { LoginStrategyServiceAbstraction } from "../../common";

import { TwoFactorAuthGuard } from "./two-factor-auth.guard";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ template: "", standalone: true })
export class EmptyComponent {}

describe("TwoFactorAuthGuard", () => {
  let loginStrategyService: MockProxy<LoginStrategyServiceAbstraction>;
  const currentAuthTypesSubject = new BehaviorSubject<AuthenticationType | null>(null);

  let twoFactorService: MockProxy<TwoFactorService>;
  let router: Router;

  beforeEach(() => {
    loginStrategyService = mock<LoginStrategyServiceAbstraction>();
    loginStrategyService.currentAuthType$ = currentAuthTypesSubject.asObservable();

    twoFactorService = mock<TwoFactorService>();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: "login", component: EmptyComponent },
          { path: "protected", component: EmptyComponent, canActivate: [TwoFactorAuthGuard] },
        ]),
        { provide: LoginStrategyServiceAbstraction, useValue: loginStrategyService },
        { provide: TwoFactorService, useValue: twoFactorService },
      ],
    });

    router = TestBed.inject(Router);
  });

  it("should redirect to /login if the user is not authenticating", async () => {
    // Arrange
    currentAuthTypesSubject.next(null);
    twoFactorService.getProviders.mockResolvedValue(null);

    // Act
    await router.navigateByUrl("/protected");

    // Assert
    expect(router.url).toBe("/login");
  });

  const authenticationTypes = Object.entries(AuthenticationType)
    // filter out reverse mappings (e.g., "0": "Password")
    .filter(([key, value]) => typeof value === "number")
    .map(([key, value]) => [value, key]) as [AuthenticationType, string][];

  authenticationTypes.forEach(([authType, authTypeName]) => {
    it(`should redirect to /login if the user is authenticating with ${authTypeName} but no two-factor providers exist`, async () => {
      // Arrange
      currentAuthTypesSubject.next(authType);
      twoFactorService.getProviders.mockResolvedValue(null);

      // Act
      await router.navigateByUrl("/protected");

      // Assert
      expect(router.url).toBe("/login");
    });
  });
});
